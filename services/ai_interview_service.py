"""
AI Interview Service — LLM-powered question generation via Groq / Mistral / Anthropic
Extends existing interview_service.py with real AI capabilities
"""

import json
import re
from typing import List, Optional, Dict, Any

import httpx
import structlog

from core.config import settings
from models.resume_model import ResumeModel

logger = structlog.get_logger(__name__)

# ─── Provider Config ──────────────────────────────────────────────────────────
GROQ_BASE = "https://api.groq.com/openai/v1/chat/completions"
MISTRAL_BASE = "https://api.mistral.ai/v1/chat/completions"
GROQ_MODEL = "llama3-70b-8192"
MISTRAL_MODEL = "mistral-large-latest"


class AIInterviewService:
    """
    LLM-powered interview question generation.
    Falls back through: Groq → Mistral → Anthropic → local templates
    """

    async def generate_ai_questions(
        self,
        resume: ResumeModel,
        job_title: str,
        job_description: Optional[str],
        difficulty: str,
        interview_type: str,
        num_questions: int,
    ) -> Dict[str, Any]:
        """Generate full interview session with ideal answers."""
        if not resume.parsed_data:
            raise ValueError("Resume must be parsed first.")

        skills = resume.parsed_data.technical_skills[:12]
        exp_years = resume.parsed_data.total_experience_years
        experience_titles = [e.title for e in (resume.parsed_data.work_experience or [])[:3]]

        prompt = self._build_generation_prompt(
            skills=skills,
            exp_years=exp_years,
            experience_titles=experience_titles,
            job_title=job_title,
            job_description=job_description or "",
            difficulty=difficulty,
            interview_type=interview_type,
            num_questions=num_questions,
        )

        raw = await self._call_llm(prompt, max_tokens=4000)
        questions = self._parse_questions(raw, num_questions, difficulty)

        return {
            "questions": questions,
            "session_metadata": {
                "model_used": self._last_model_used,
                "total_questions": len(questions),
                "difficulty": difficulty,
                "interview_type": interview_type,
                "estimated_duration_minutes": len(questions) * 5,
                "job_title": job_title,
                "candidate_skills": skills[:6],
            }
        }

    def _build_generation_prompt(self, **ctx) -> str:
        type_instructions = {
            "technical": "Focus entirely on technical depth, system design, coding concepts, and architecture.",
            "behavioral": "Use only STAR-format behavioral questions about past experiences.",
            "situational": "Present hypothetical scenarios requiring problem-solving and decision-making.",
            "mixed": "Mix: 40% technical, 35% behavioral (STAR), 25% situational.",
        }.get(ctx["interview_type"], "Mix technical, behavioral, and situational questions.")

        diff_instructions = {
            "easy": "Entry-level depth. Clear, approachable questions. No trick questions.",
            "medium": "Mid-level depth. Requires solid understanding and practical experience.",
            "hard": "Senior/Lead level. Deep expertise, edge cases, system design scale, leadership scenarios.",
        }.get(ctx["difficulty"], "Medium difficulty.")

        return f"""You are an expert technical interviewer at a top tech company. Generate a precise, structured interview.

CANDIDATE PROFILE:
- Skills: {', '.join(ctx['skills']) or 'Software Development'}
- Experience: {ctx['exp_years']} years
- Recent roles: {', '.join(ctx['experience_titles']) or 'Software Engineer'}

TARGET ROLE: {ctx['job_title']}
JOB CONTEXT: {ctx['job_description'][:600] if ctx['job_description'] else 'Senior engineering role'}

INTERVIEW TYPE: {type_instructions}
DIFFICULTY: {diff_instructions}

Generate EXACTLY {ctx['num_questions']} interview questions.

Return ONLY valid JSON in this exact format — no markdown, no explanation:
{{
  "questions": [
    {{
      "id": 1,
      "type": "technical|behavioral|situational",
      "category": "specific topic (e.g. System Design, Python Internals, Leadership)",
      "difficulty": "{ctx['difficulty']}",
      "question": "The full interview question text",
      "what_to_look_for": "What a strong candidate would cover",
      "ideal_answer": "A comprehensive model answer (3-5 sentences)",
      "follow_up_questions": ["Follow-up 1", "Follow-up 2"],
      "time_limit_seconds": 120,
      "scoring_criteria": {{
        "technical_accuracy": "What correct technical details look like",
        "depth": "What depth of explanation is expected",
        "communication": "How to evaluate explanation clarity"
      }}
    }}
  ]
}}"""

    def _parse_questions(self, raw: str, expected: int, difficulty: str) -> List[Dict]:
        """Parse LLM JSON output with multiple fallback strategies."""
        # Try direct JSON parse
        try:
            data = json.loads(raw)
            if "questions" in data:
                return self._normalize_questions(data["questions"])
        except json.JSONDecodeError:
            pass

        # Try extracting JSON from markdown
        json_match = re.search(r'\{.*"questions".*\}', raw, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group(0))
                if "questions" in data:
                    return self._normalize_questions(data["questions"])
            except json.JSONDecodeError:
                pass

        logger.warning("LLM JSON parse failed — using template fallback")
        return self._fallback_questions(expected, difficulty)

    def _normalize_questions(self, questions: List[Dict]) -> List[Dict]:
        """Ensure all required fields are present."""
        normalized = []
        for i, q in enumerate(questions):
            normalized.append({
                "id": i + 1,
                "question_number": i + 1,
                "type": q.get("type", "technical"),
                "category": q.get("category", "General"),
                "difficulty": q.get("difficulty", "medium"),
                "question": q.get("question", ""),
                "what_to_look_for": q.get("what_to_look_for", ""),
                "ideal_answer": q.get("ideal_answer", ""),
                "follow_up_questions": q.get("follow_up_questions", []),
                "time_limit_seconds": q.get("time_limit_seconds", 120),
                "scoring_criteria": q.get("scoring_criteria", {}),
                "sample_answer_framework": "STAR (Situation, Task, Action, Result)" if q.get("type") == "behavioral" else None,
            })
        return normalized

    def _fallback_questions(self, n: int, difficulty: str) -> List[Dict]:
        FALLBACK = [
            {"type": "technical", "category": "System Design", "question": "Design a URL shortener service. Walk through your architecture choices.", "time_limit_seconds": 180},
            {"type": "behavioral", "category": "Leadership", "question": "Describe a time you led a team through a technical crisis. What was your approach?", "time_limit_seconds": 120},
            {"type": "technical", "category": "Data Structures", "question": "Explain how you would implement a rate limiter for a distributed API system.", "time_limit_seconds": 150},
            {"type": "situational", "category": "Decision Making", "question": "You discover a critical security vulnerability in production 1 hour before a major demo. What do you do?", "time_limit_seconds": 120},
            {"type": "technical", "category": "Performance", "question": "How would you diagnose and fix a slow database query in a production system?", "time_limit_seconds": 120},
            {"type": "behavioral", "category": "Collaboration", "question": "Tell me about a time you had a major disagreement with a colleague about a technical decision. How did it resolve?", "time_limit_seconds": 120},
            {"type": "technical", "category": "Architecture", "question": "What are the trade-offs between microservices and monolithic architectures?", "time_limit_seconds": 150},
            {"type": "situational", "category": "Prioritization", "question": "You have 3 critical bugs and a deadline tomorrow. How do you prioritize?", "time_limit_seconds": 90},
            {"type": "behavioral", "category": "Growth", "question": "Describe your approach to learning new technologies. Give a recent example.", "time_limit_seconds": 90},
            {"type": "technical", "category": "Security", "question": "How would you secure a REST API handling sensitive financial data?", "time_limit_seconds": 150},
        ]
        return [self._normalize_questions([{**FALLBACK[i % len(FALLBACK)], "id": i+1}])[0] for i in range(n)]

    async def evaluate_answer(
        self,
        question: str,
        user_answer: str,
        ideal_answer: str,
        question_type: str,
        difficulty: str,
    ) -> Dict[str, Any]:
        """Evaluate a user's answer and return structured feedback."""
        prompt = f"""You are an expert technical interviewer evaluating an interview answer.

QUESTION: {question}
QUESTION TYPE: {question_type}
DIFFICULTY: {difficulty}
IDEAL ANSWER CONTEXT: {ideal_answer[:500]}

CANDIDATE'S ANSWER: {user_answer[:1500]}

Evaluate this answer and return ONLY valid JSON (no markdown):
{{
  "score": <integer 0-10>,
  "grade": "<A+|A|B|C|D|F>",
  "confidence_level": "<high|medium|low>",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "improved_answer": "A better version of their answer incorporating what they got right plus what they missed",
  "key_missing_concepts": ["concept 1", "concept 2"],
  "follow_up_recommendation": "Suggested area to study",
  "detailed_feedback": "2-3 sentences of constructive coaching feedback",
  "criteria_scores": {{
    "technical_accuracy": <0-10>,
    "depth": <0-10>,
    "clarity": <0-10>,
    "completeness": <0-10>
  }}
}}"""

        raw = await self._call_llm(prompt, max_tokens=1200)
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            json_match = re.search(r'\{.*\}', raw, re.DOTALL)
            if json_match:
                try:
                    data = json.loads(json_match.group(0))
                except Exception:
                    data = self._fallback_evaluation(user_answer)
            else:
                data = self._fallback_evaluation(user_answer)

        # Normalize score
        score = int(data.get("score", 5))
        data["score"] = max(0, min(10, score))
        data["points_earned"] = self._calculate_points(data["score"])
        return data

    def _calculate_points(self, score: int) -> int:
        if score >= 9: return 20
        if score >= 7: return 15
        if score >= 5: return 10
        if score >= 3: return 5
        return 2

    def _fallback_evaluation(self, answer: str) -> Dict:
        word_count = len(answer.split())
        score = min(8, max(2, word_count // 20))
        return {
            "score": score, "grade": "B" if score >= 7 else "C",
            "confidence_level": "medium",
            "strengths": ["Attempt was made", "Answer provided"],
            "weaknesses": ["Could be more detailed"],
            "improved_answer": answer,
            "key_missing_concepts": [],
            "follow_up_recommendation": "Review core concepts",
            "detailed_feedback": "Answer submitted. Review the ideal answer for improvement.",
            "criteria_scores": {"technical_accuracy": score, "depth": score - 1, "clarity": score, "completeness": score - 1},
        }

    # ─── LLM Callers ─────────────────────────────────────────────────────────
    _last_model_used: str = "template"

    async def _call_llm(self, prompt: str, max_tokens: int = 2000) -> str:
        """Try LLM providers in order."""
        # Try Groq first (fastest)
        if hasattr(settings, 'GROQ_API_KEY') and settings.GROQ_API_KEY:
            result = await self._call_groq(prompt, max_tokens)
            if result:
                self._last_model_used = f"groq/{GROQ_MODEL}"
                return result

        # Try Mistral
        if hasattr(settings, 'MISTRAL_API_KEY') and settings.MISTRAL_API_KEY:
            result = await self._call_mistral(prompt, max_tokens)
            if result:
                self._last_model_used = f"mistral/{MISTRAL_MODEL}"
                return result

        # Try Anthropic (existing setting)
        if settings.ANTHROPIC_API_KEY:
            result = await self._call_anthropic(prompt, max_tokens)
            if result:
                self._last_model_used = "anthropic/claude-haiku"
                return result

        # Try OpenAI
        if settings.OPENAI_API_KEY:
            result = await self._call_openai(prompt, max_tokens)
            if result:
                self._last_model_used = "openai/gpt-3.5-turbo"
                return result

        self._last_model_used = "template"
        return ""

    async def _call_groq(self, prompt: str, max_tokens: int) -> Optional[str]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.post(
                    GROQ_BASE,
                    headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}", "Content-Type": "application/json"},
                    json={"model": GROQ_MODEL, "messages": [{"role": "user", "content": prompt}], "max_tokens": max_tokens, "temperature": 0.7},
                )
                return r.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.warning("Groq failed", error=str(e))
            return None

    async def _call_mistral(self, prompt: str, max_tokens: int) -> Optional[str]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.post(
                    MISTRAL_BASE,
                    headers={"Authorization": f"Bearer {settings.MISTRAL_API_KEY}", "Content-Type": "application/json"},
                    json={"model": MISTRAL_MODEL, "messages": [{"role": "user", "content": prompt}], "max_tokens": max_tokens},
                )
                return r.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.warning("Mistral failed", error=str(e))
            return None

    async def _call_anthropic(self, prompt: str, max_tokens: int) -> Optional[str]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={"x-api-key": settings.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json"},
                    json={"model": "claude-haiku-20240307", "max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]},
                )
                return r.json()["content"][0]["text"].strip()
        except Exception as e:
            logger.warning("Anthropic failed", error=str(e))
            return None

    async def _call_openai(self, prompt: str, max_tokens: int) -> Optional[str]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                r = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                    json={"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": prompt}], "max_tokens": max_tokens},
                )
                return r.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.warning("OpenAI failed", error=str(e))
            return None