"""
Answer Evaluation Service — Groq LLM (llama3-70b-8192) powered evaluation
Scores 0-100 per answer and generates structured feedback
"""
import json
import re
from typing import Dict, List, Optional, Any

import httpx
import structlog

from core.config import settings

logger = structlog.get_logger(__name__)

GROQ_URL  = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

FILLER_WORDS = {
    "um","uh","ah","er","like","you know","basically","literally","actually",
    "so","right","okay","i mean","kind of","sort of","just","honestly","obviously",
    "definitely","absolutely","very","really","thing","stuff",
}


class EvaluationService:

    async def evaluate_answer(
        self,
        question:       str,
        answer:         str,
        category:       str = "technical",
        difficulty:     str = "medium",
        job_title:      str = "Software Engineer",
        ideal_answer:   str = "",
        voice_pauses:   int = 0,       # num of detected pauses
        speech_rate:    float = 0.0,   # words per minute (0 = unknown)
    ) -> Dict[str, Any]:
        """
        Full evaluation — returns scores + feedback.
        Falls back to heuristic if API call fails.
        """
        if not answer.strip() or len(answer.strip()) < 5:
            return self._empty_answer_result()

        # Count filler words in transcript
        words  = answer.lower().split()
        fillers = sum(1 for w in words if w.strip(".,!?") in FILLER_WORDS)

        # Confidence heuristic from voice metadata
        conf_penalty = 0
        if voice_pauses > 5:   conf_penalty += 10
        if voice_pauses > 10:  conf_penalty += 15
        if speech_rate > 0 and (speech_rate < 80 or speech_rate > 200):
            conf_penalty += 10
        if fillers > 5:        conf_penalty += 10

        prompt = self._build_prompt(question, answer, category, difficulty, job_title, ideal_answer, fillers)

        raw = await self._call_groq(prompt)
        if not raw:
            return self._heuristic_eval(answer, question, fillers, conf_penalty)

        result = self._parse_response(raw)
        if not result:
            return self._heuristic_eval(answer, question, fillers, conf_penalty)

        # Apply voice-based confidence adjustment
        result["confidence_score"] = max(0, result.get("confidence_score", 60) - conf_penalty)
        result["filler_word_count"] = fillers
        result["voice_pauses"]      = voice_pauses
        result["speech_rate_wpm"]   = round(speech_rate, 1)

        # Compute composite overall score
        result["overall_score"] = round(
            result.get("relevance_score", 60) * 0.35 +
            result.get("clarity_score",   60) * 0.25 +
            result.get("confidence_score",60) * 0.20 +
            result.get("technical_score", 60) * 0.20,
            1,
        )

        logger.info("Answer evaluated", score=result["overall_score"])
        return result

    # ── Prompt builder ────────────────────────────────────────────────────────
    def _build_prompt(self, question, answer, category, difficulty, job_title, ideal, fillers):
        return f"""You are an expert technical interviewer evaluating a job interview answer.

ROLE BEING INTERVIEWED FOR: {job_title}
QUESTION CATEGORY: {category}
DIFFICULTY: {difficulty}
QUESTION: {question}
CANDIDATE'S ANSWER: {answer}
IDEAL ANSWER CONTEXT: {ideal or "Not provided — use your expertise."}
FILLER WORDS DETECTED: {fillers}

Evaluate strictly and return ONLY valid JSON — no markdown, no explanation, no code fences:
{{
  "relevance_score": <0-100, how well answer addresses the question>,
  "clarity_score": <0-100, how clearly structured and articulate>,
  "confidence_score": <0-100, based on language certainty and completeness>,
  "technical_score": <0-100, technical accuracy and depth>,
  "overall_score": <0-100, weighted composite>,
  "grade": "<A+|A|B+|B|C+|C|D|F>",
  "feedback": "<2-3 sentences of honest, constructive coach-style feedback>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "improvement_tips": ["<tip 1>", "<tip 2>", "<tip 3>"],
  "ideal_answer_summary": "<brief model answer in 2-3 sentences>",
  "keywords_found": ["<relevant term found in answer>"],
  "keywords_missing": ["<important term missing from answer>"],
  "confidence_indicators": {{
    "uses_hedge_language": <true|false>,
    "answer_is_complete": <true|false>,
    "shows_examples": <true|false>,
    "uses_structured_format": <true|false>
  }}
}}"""

    # ── Groq API call ─────────────────────────────────────────────────────────
    async def _call_groq(self, prompt: str) -> Optional[str]:
        key = getattr(settings, "GROQ_API_KEY", None)

        if not key:
            logger.warning("GROQ_API_KEY not set — using heuristic evaluation")
            return None

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                r = await client.post(
                    GROQ_URL,
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": GROQ_MODEL,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 1000,
                        "temperature": 0.3,
                    },
                )

                data = r.json()

                # 🔥 IMPORTANT FIX
                if r.status_code != 200:
                    logger.error("Groq API failed", status=r.status_code, response=data)
                    return None

                if "choices" not in data:
                    logger.error("Groq invalid response", response=data)
                    return None

                return data["choices"][0]["message"]["content"].strip()

        except Exception as e:
            logger.error("Groq API error", error=str(e))
            return None

    # ── Parse LLM JSON response ───────────────────────────────────────────────
    def _parse_response(self, raw: str) -> Optional[Dict]:
        # Try direct parse
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass
        # Try extracting JSON block
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                pass
        return None

    # ── Heuristic fallback ────────────────────────────────────────────────────
    def _heuristic_eval(self, answer: str, question: str, fillers: int, conf_penalty: int) -> Dict:
        words = answer.split()
        length_score  = min(100, max(20, len(words) * 2))          # longer = better up to 50 words
        filler_penalty = min(30, fillers * 4)
        base = max(30, length_score - filler_penalty - conf_penalty)

        return {
            "relevance_score":   min(100, base + 10),
            "clarity_score":     min(100, base),
            "confidence_score":  max(0,   base - conf_penalty),
            "technical_score":   min(100, base + 5),
            "overall_score":     base,
            "grade":             self._grade(base),
            "feedback":          "Evaluation performed locally — connect Groq API for AI feedback.",
            "strengths":         ["Answer was submitted"],
            "weaknesses":        ["Add more detail and examples for higher scores"],
            "improvement_tips":  ["Be more specific", "Use the STAR method for behavioral questions", "Add technical depth"],
            "ideal_answer_summary": "See the question again and structure your answer with Situation, Task, Action, Result.",
            "keywords_found":    [],
            "keywords_missing":  [],
            "filler_word_count": fillers,
            "confidence_indicators": {
                "uses_hedge_language":     fillers > 3,
                "answer_is_complete":      len(words) > 30,
                "shows_examples":          "example" in answer.lower() or "for instance" in answer.lower(),
                "uses_structured_format":  any(w in answer.lower() for w in ["first","second","finally","step"]),
            },
        }

    def _empty_answer_result(self) -> Dict:
        return {
            "relevance_score": 0, "clarity_score": 0, "confidence_score": 0,
            "technical_score": 0, "overall_score": 0, "grade": "F",
            "feedback": "No answer provided for this question.",
            "strengths": [], "weaknesses": ["No answer given"],
            "improvement_tips": ["Always attempt to answer — partial answers are scored higher than blank ones."],
            "ideal_answer_summary": "", "keywords_found": [], "keywords_missing": [],
            "filler_word_count": 0,
        }

    def _grade(self, score: float) -> str:
        if score >= 95: return "A+"
        if score >= 90: return "A"
        if score >= 85: return "B+"
        if score >= 75: return "B"
        if score >= 65: return "C+"
        if score >= 55: return "C"
        if score >= 45: return "D"
        return "F"

    # ── Session summary evaluator ─────────────────────────────────────────────
    async def generate_session_summary(
        self,
        job_title: str,
        qa_pairs: List[Dict],
        overall_score: float,
        cheating_score: float,
    ) -> Dict[str, Any]:
        """Generate a holistic summary for the final report after all answers."""
        if not getattr(settings, "GROQ_API_KEY", None):
            return self._fallback_summary(qa_pairs, overall_score)

        qa_text = "\n".join([
            f"Q{i+1}: {qa['question']}\nA: {qa['answer'][:200]}...\nScore: {qa.get('score',0)}/100"
            for i, qa in enumerate(qa_pairs[:10])
        ])

        prompt = f"""You are a career coach reviewing a mock interview for: {job_title}

OVERALL SCORE: {overall_score}/100
CHEATING SCORE: {cheating_score*100:.0f}/100 (higher = more suspicious)

QUESTIONS AND ANSWERS:
{qa_text}

Write a comprehensive interview report. Return ONLY valid JSON:
{{
  "executive_summary": "<3-4 sentence overall performance summary>",
  "top_strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "critical_gaps": ["<gap 1>", "<gap 2>", "<gap 3>"],
  "skill_radar": {{
    "technical_knowledge": <0-100>,
    "communication": <0-100>,
    "problem_solving": <0-100>,
    "confidence": <0-100>,
    "interview_readiness": <0-100>
  }},
  "hiring_recommendation": "<Strong Yes|Yes|Maybe|No>",
  "next_steps": ["<action 1>", "<action 2>", "<action 3>"],
  "estimated_experience_level": "<junior|mid|senior|lead>"
}}"""

        raw = await self._call_groq(prompt)
        if raw:
            parsed = self._parse_response(raw)
            if parsed:
                return parsed

        return self._fallback_summary(qa_pairs, overall_score)

    def _fallback_summary(self, qa_pairs, overall_score):
        return {
            "executive_summary": f"Candidate completed the interview with an overall score of {overall_score:.0f}/100. Connect Groq API for detailed AI analysis.",
            "top_strengths": ["Completed all questions", "Showed effort in responses"],
            "critical_gaps": ["More detail needed", "Improve technical depth"],
            "skill_radar": {
                "technical_knowledge": overall_score,
                "communication": overall_score * 0.9,
                "problem_solving": overall_score * 0.85,
                "confidence": overall_score * 0.8,
                "interview_readiness": overall_score * 0.9,
            },
            "hiring_recommendation": "Maybe" if overall_score >= 60 else "No",
            "next_steps": ["Practice daily", "Study system design", "Work on STAR method"],
            "estimated_experience_level": "mid",
        }
