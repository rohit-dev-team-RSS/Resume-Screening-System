"""
Interview Service — AI-generated mock interview questions based on resume + JD
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional

import httpx
import structlog

from core.config import settings
from models.resume_model import ResumeModel
from schemas.resume_schema import InterviewQuestion, InterviewResponse

logger = structlog.get_logger(__name__)

# ─── Question Bank (fallback when no LLM) ────────────────────────────────────
BEHAVIORAL_QUESTIONS = [
    {"q": "Tell me about a time you faced a major technical challenge and how you overcame it.", "category": "Problem Solving", "framework": "STAR"},
    {"q": "Describe a situation where you had to work with a difficult team member.", "category": "Teamwork", "framework": "STAR"},
    {"q": "Give an example of when you had to meet a tight deadline.", "category": "Time Management", "framework": "STAR"},
    {"q": "Tell me about your greatest professional achievement.", "category": "Achievement", "framework": "STAR"},
    {"q": "Describe a time you had to learn a new technology quickly.", "category": "Adaptability", "framework": "STAR"},
    {"q": "How do you handle disagreements with your manager?", "category": "Communication", "framework": "STAR"},
    {"q": "Tell me about a project you're most proud of.", "category": "Technical Pride", "framework": "STAR"},
    {"q": "Describe a situation where you had to make a decision with incomplete information.", "category": "Decision Making", "framework": "STAR"},
]

SITUATIONAL_QUESTIONS = [
    {"q": "If you discovered a critical bug in production 1 hour before a major release, what would you do?", "category": "Crisis Management"},
    {"q": "How would you approach designing a system that needs to scale to 10 million users?", "category": "System Design"},
    {"q": "If your team cannot agree on a technical approach, how would you resolve it?", "category": "Leadership"},
    {"q": "How would you prioritize between 3 equally urgent tasks with the same deadline?", "category": "Prioritization"},
    {"q": "If a senior stakeholder asks for a feature that you believe is technically infeasible, how do you respond?", "category": "Stakeholder Management"},
]

TECHNICAL_TEMPLATES = {
    "python": [
        "Explain the difference between `__init__` and `__new__` in Python.",
        "What are Python decorators and when would you use them?",
        "Describe Python's GIL and its impact on multithreading.",
        "How does memory management work in Python?",
    ],
    "javascript": [
        "Explain event loop and call stack in JavaScript.",
        "What is the difference between `==` and `===`?",
        "Describe closures and provide a real-world use case.",
        "How does the prototype chain work?",
    ],
    "react": [
        "Explain the virtual DOM and reconciliation in React.",
        "When would you use `useCallback` vs `useMemo`?",
        "How do you handle state management in large React apps?",
        "Explain React's Context API vs Redux.",
    ],
    "docker": [
        "What is the difference between a Docker image and a container?",
        "How would you optimize a Dockerfile for smaller image size?",
        "Explain Docker networking modes.",
        "What is Docker Compose and when would you use it?",
    ],
    "aws": [
        "Explain the difference between EC2, ECS, and Lambda.",
        "How would you design a highly available architecture on AWS?",
        "What is the difference between SQS and SNS?",
        "Explain VPC, subnets, and security groups.",
    ],
    "sql": [
        "Explain the difference between INNER JOIN, LEFT JOIN, and FULL OUTER JOIN.",
        "How do database indexes work and when should you add them?",
        "What is N+1 query problem and how do you solve it?",
        "Explain ACID properties.",
    ],
    "default": [
        "Walk me through your architecture decisions on your most complex project.",
        "How do you ensure code quality in your projects?",
        "What is your approach to debugging production issues?",
        "How do you stay up to date with new technologies?",
    ],
}


class InterviewService:

    async def generate_interview(
        self,
        resume: ResumeModel,
        job_description: Optional[str],
        job_title: Optional[str],
        difficulty: str,
        interview_type: str,
        num_questions: int,
    ) -> InterviewResponse:
        if not resume.parsed_data:
            raise ValueError("Resume must be parsed before generating interview.")

        skills = resume.parsed_data.technical_skills
        experience = resume.parsed_data.work_experience

        questions = []
        q_num = 1

        # ── Technical Questions ───────────────────────────────────────────────
        if interview_type in ("technical", "mixed"):
            tech_qs = await self._generate_technical_questions(
                skills, job_description, difficulty,
                num_technical=num_questions // 2 if interview_type == "mixed" else num_questions,
            )
            for q in tech_qs:
                questions.append(InterviewQuestion(
                    question_number=q_num,
                    type="technical",
                    question=q["question"],
                    category=q.get("category", "Technical"),
                    difficulty=difficulty,
                    what_to_look_for=q.get("what_to_look_for", "Clear explanation with practical examples"),
                    sample_answer_framework=q.get("framework"),
                    follow_up_questions=q.get("follow_ups", []),
                ))
                q_num += 1

        # ── Behavioral Questions ──────────────────────────────────────────────
        if interview_type in ("behavioral", "mixed"):
            beh_count = num_questions // 3 if interview_type == "mixed" else num_questions
            for bq in BEHAVIORAL_QUESTIONS[:beh_count]:
                questions.append(InterviewQuestion(
                    question_number=q_num,
                    type="behavioral",
                    question=bq["q"],
                    category=bq["category"],
                    difficulty=difficulty,
                    what_to_look_for="Specific situation, actions taken, measurable outcomes",
                    sample_answer_framework=bq.get("framework", "STAR"),
                    follow_up_questions=["What was the outcome?", "What would you do differently?"],
                ))
                q_num += 1

        # ── Situational Questions ─────────────────────────────────────────────
        if interview_type in ("situational", "mixed"):
            sit_count = num_questions // 4 if interview_type == "mixed" else num_questions
            for sq in SITUATIONAL_QUESTIONS[:sit_count]:
                questions.append(InterviewQuestion(
                    question_number=q_num,
                    type="situational",
                    question=sq["q"],
                    category=sq["category"],
                    difficulty=difficulty,
                    what_to_look_for="Structured thinking, prioritization, communication clarity",
                    follow_up_questions=["How would you communicate this to stakeholders?"],
                ))
                q_num += 1

        # Trim to requested count
        questions = questions[:num_questions]

        interview_id = str(uuid.uuid4())
        return InterviewResponse(
            interview_id=interview_id,
            resume_id=str(resume.id),
            job_title=job_title,
            questions=questions,
            preparation_tips=self._get_prep_tips(skills, difficulty),
            estimated_duration_minutes=num_questions * 4,
            created_at=datetime.now(timezone.utc),
        )

    async def _generate_technical_questions(
        self,
        skills: List[str],
        job_description: Optional[str],
        difficulty: str,
        num_technical: int,
    ) -> List[dict]:
        questions = []
        # Prioritize questions based on candidate skills
        for skill in skills[:4]:
            skill_lower = skill.lower()
            bank = TECHNICAL_TEMPLATES.get(skill_lower, TECHNICAL_TEMPLATES["default"])
            for q_text in bank[:2]:
                questions.append({
                    "question": q_text,
                    "category": f"{skill.title()} Fundamentals",
                    "what_to_look_for": f"Deep understanding of {skill.title()} internals and practical experience",
                    "follow_ups": [
                        f"Have you used {skill.title()} in production? What scale?",
                        f"What are the limitations of {skill.title()} you've encountered?",
                    ],
                })

        # Add default if not enough
        if len(questions) < num_technical:
            for q_text in TECHNICAL_TEMPLATES["default"]:
                questions.append({
                    "question": q_text,
                    "category": "General Technical",
                    "what_to_look_for": "Depth of technical knowledge and architectural thinking",
                })

        return questions[:num_technical]

    def _get_prep_tips(self, skills: List[str], difficulty: str) -> List[str]:
        tips = [
            "Research the company's products, culture, and recent news before the interview.",
            "Prepare 2-3 concise stories using the STAR method (Situation, Task, Action, Result).",
            "Have 3-5 thoughtful questions ready to ask the interviewer.",
            "Review your resume and be ready to elaborate on every bullet point.",
        ]
        if skills:
            tips.append(f"Brush up on core concepts in: {', '.join(skills[:4])}.")
        if difficulty == "hard":
            tips.append("Practice system design problems on excalidraw.com or paper.")
            tips.append("Review time/space complexity of common algorithms (LeetCode Medium-Hard).")
        tips.append("Test your video/audio setup 30 minutes before virtual interviews.")
        return tips
