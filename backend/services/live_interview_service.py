"""
Live Interview Service — session CRUD + question bank + cheating processing
"""
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any

import structlog
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.interview_session_model import (
    InterviewSession, SessionStatus, CheatingEventRecord, QuestionAnswer,
    DifficultyLevel, CheatingEventType,
)

logger = structlog.get_logger(__name__)

# ── Cheating event weights ────────────────────────────────────────────────────
CHEATING_WEIGHTS = {
    CheatingEventType.TAB_SWITCH:       0.15,
    CheatingEventType.FACE_MISSING:     0.10,
    CheatingEventType.MULTIPLE_FACES:   0.22,
    CheatingEventType.LOOKING_AWAY:     0.06,
    CheatingEventType.PHONE_DETECTED:   0.18,
    CheatingEventType.COPY_PASTE:       0.20,
    CheatingEventType.DEVTOOLS_OPEN:    0.25,
    CheatingEventType.WINDOW_BLUR:      0.08,
}

SEVERITY_MULT = { "low": 0.5, "medium": 1.0, "high": 1.6, "critical": 2.5 }

# ── Question Bank ─────────────────────────────────────────────────────────────
QUESTION_BANK = {
    "technical": {
        "easy": [
            {"text": "What is the difference between a stack and a queue? Give a real-world example.", "category": "technical"},
            {"text": "Explain what REST APIs are and why they're used.", "category": "technical"},
            {"text": "What is the difference between SQL and NoSQL databases?", "category": "technical"},
            {"text": "Explain the concept of version control and why Git is important.", "category": "technical"},
        ],
        "medium": [
            {"text": "Explain how you would design a URL shortener service. Walk through the architecture.", "category": "technical"},
            {"text": "What is the CAP theorem and how does it affect distributed system design?", "category": "technical"},
            {"text": "Describe the difference between horizontal and vertical scaling, and when you'd choose each.", "category": "technical"},
            {"text": "How would you optimize a slow SQL query? Walk through your debugging process.", "category": "technical"},
            {"text": "What are microservices? What are their advantages and drawbacks compared to monoliths?", "category": "technical"},
        ],
        "hard": [
            {"text": "Design a rate limiting system that handles 1M requests per second. Explain your data structures and tradeoffs.", "category": "technical"},
            {"text": "How would you implement distributed caching to reduce database load by 80%? What invalidation strategy would you use?", "category": "technical"},
            {"text": "Walk me through designing a real-time notification system for 10M users. Address consistency and fault tolerance.", "category": "technical"},
            {"text": "Explain consensus algorithms in distributed systems. When would you use Raft vs Paxos?", "category": "technical"},
        ],
    },
    "behavioral": {
        "easy": [
            {"text": "Tell me about yourself and why you're interested in this role.", "category": "behavioral"},
            {"text": "Describe a time you had to learn a new skill quickly. How did you approach it?", "category": "behavioral"},
        ],
        "medium": [
            {"text": "Tell me about a time you had a major conflict with a colleague. How did you resolve it?", "category": "behavioral"},
            {"text": "Describe the most challenging project you've worked on. What made it difficult and how did you overcome it?", "category": "behavioral"},
            {"text": "Give an example of when you had to make a decision with incomplete information. What was the outcome?", "category": "behavioral"},
            {"text": "Tell me about a time you failed at something important. What did you learn?", "category": "behavioral"},
        ],
        "hard": [
            {"text": "Describe a time you had to influence a decision without having authority. What was your strategy?", "category": "behavioral"},
            {"text": "Tell me about leading a team through a major technical crisis. How did you prioritize and communicate?", "category": "behavioral"},
        ],
    },
    "situational": {
        "medium": [
            {"text": "You discover a critical security vulnerability in production 2 hours before a major product launch. What do you do?", "category": "situational"},
            {"text": "Your team is 3 weeks behind on a 2-month project and the deadline is non-negotiable. How do you handle this?", "category": "situational"},
            {"text": "A senior engineer disagrees with your technical approach and escalates to your manager. How do you respond?", "category": "situational"},
        ],
        "hard": [
            {"text": "You're asked to cut your team's project timeline by 40% without reducing scope. What's your plan?", "category": "situational"},
            {"text": "You notice your manager is making a strategic decision based on incorrect data. How do you handle it?", "category": "situational"},
        ],
    },
}


class LiveInterviewService:

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.col = db.live_interview_sessions

    # ── Create session ────────────────────────────────────────────────────────
    async def create_session(
        self,
        user_id:        str,
        job_title:      str,
        difficulty:     str,
        interview_type: str,
        num_questions:  int = 8,
    ) -> Dict:
        questions = self._pick_questions(difficulty, interview_type, num_questions)

        session_id = str(uuid.uuid4())
        doc = {
            "_id": session_id,
            "user_id": user_id,
            "job_title": job_title,
            "difficulty": difficulty,
            "interview_type": interview_type,
            "status": SessionStatus.PENDING,
            "questions": questions,
            "answers": [],
            "cheating_events": [],
            "cheating_score": 0.0,
            "warning_count": 0,
            "session_aborted": False,
            "overall_score": None,
            "started_at": None,
            "completed_at": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await self.col.insert_one(doc)
        return {"session_id": session_id, "questions": questions, "total_questions": len(questions)}

    # ── Start session ─────────────────────────────────────────────────────────
    async def start_session(self, session_id: str, user_id: str) -> bool:
        result = await self.col.update_one(
            {"_id": session_id, "user_id": user_id},
            {"$set": {
                "status": SessionStatus.ACTIVE,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return result.modified_count > 0

    # ── Save answer ───────────────────────────────────────────────────────────
    async def save_answer(
        self,
        session_id:  str,
        user_id:     str,
        answer_data: Dict,
    ) -> bool:
        now = datetime.now(timezone.utc).isoformat()
        result = await self.col.update_one(
            {"_id": session_id, "user_id": user_id},
            {
                "$push": {"answers": answer_data},
                "$set":  {"updated_at": now},
            },
        )
        return result.modified_count > 0

    # ── Record cheating event ─────────────────────────────────────────────────
    async def record_cheating_event(
        self,
        session_id: str,
        user_id:    str,
        event:      Dict,
    ) -> Dict:
        session = await self.col.find_one({"_id": session_id, "user_id": user_id})
        if not session:
            return {"error": "Session not found"}

        events = session.get("cheating_events", []) + [event]
        score  = self._compute_cheating_score(events)
        warnings = self._count_warnings(events)
        aborted  = warnings >= 3

        update = {
            "$push": {"cheating_events": event},
            "$set": {
                "cheating_score":   score,
                "warning_count":    warnings,
                "session_aborted":  aborted,
                "updated_at":       datetime.now(timezone.utc).isoformat(),
            },
        }
        if aborted:
            update["$set"]["status"] = SessionStatus.ABORTED
            update["$set"]["abort_reason"] = "Exceeded maximum cheating warnings"

        await self.col.update_one({"_id": session_id}, update)

        return {
            "cheating_score": score,
            "warning_count":  warnings,
            "session_aborted": aborted,
            "abort_reason":    "Too many integrity violations" if aborted else None,
        }

    # ── Complete session ──────────────────────────────────────────────────────
    async def complete_session(
        self,
        session_id:   str,
        user_id:      str,
        overall_data: Dict,
    ) -> Dict:
        now = datetime.now(timezone.utc).isoformat()
        await self.col.update_one(
            {"_id": session_id, "user_id": user_id},
            {"$set": {
                "status":              SessionStatus.COMPLETED,
                "overall_score":       overall_data.get("overall_score"),
                "avg_confidence":      overall_data.get("avg_confidence"),
                "avg_clarity":         overall_data.get("avg_clarity"),
                "avg_relevance":       overall_data.get("avg_relevance"),
                "strength_areas":      overall_data.get("strengths", []),
                "weakness_areas":      overall_data.get("weaknesses", []),
                "improvement_summary": overall_data.get("summary"),
                "session_summary":     overall_data.get("session_summary"),
                "completed_at":        now,
                "updated_at":          now,
            }},
        )
        session = await self.col.find_one({"_id": session_id})
        if session:
            session["id"] = session.pop("_id")
        return session or {}

    # ── Get session ───────────────────────────────────────────────────────────
    async def get_session(self, session_id: str, user_id: str) -> Optional[Dict]:
        doc = await self.col.find_one({"_id": session_id, "user_id": user_id})
        if doc:
            doc["id"] = doc.pop("_id")
        return doc

    # ── User history ──────────────────────────────────────────────────────────
    async def get_user_history(self, user_id: str, limit: int = 20) -> List[Dict]:
        cursor = self.col.find(
            {"user_id": user_id, "status": {"$in": [SessionStatus.COMPLETED, SessionStatus.ABORTED]}},
            {"questions": 0, "cheating_events": 0},
        ).sort("created_at", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        for d in docs:
            d["id"] = d.pop("_id")
        return docs

    # ── Helpers ───────────────────────────────────────────────────────────────
    def _pick_questions(self, difficulty: str, interview_type: str, n: int) -> List[Dict]:
        pool = []
        if interview_type in ("technical", "mixed"):
            d = difficulty if difficulty in ("easy","medium","hard") else "medium"
            pool.extend(QUESTION_BANK["technical"].get(d, []))
            if interview_type == "mixed":
                pool.extend(QUESTION_BANK["behavioral"].get(d, []))
                pool.extend(QUESTION_BANK["situational"].get(d, []))
        elif interview_type == "behavioral":
            d = difficulty if difficulty in ("easy","medium","hard") else "medium"
            pool.extend(QUESTION_BANK["behavioral"].get(d, []))
        elif interview_type == "situational":
            pool.extend(QUESTION_BANK["situational"].get("medium", []))

        import random
        random.shuffle(pool)
        selected = pool[:n]
        return [{"id": i+1, **q, "difficulty": difficulty} for i, q in enumerate(selected)]

    def _compute_cheating_score(self, events: List[Dict]) -> float:
        raw = 0.0
        for ev in events:
            et = ev.get("event_type", "")
            try:
                weight = CHEATING_WEIGHTS.get(CheatingEventType(et), 0.05)
            except ValueError:
                weight = 0.05
            mult   = SEVERITY_MULT.get(ev.get("severity", "medium"), 1.0)
            raw   += weight * mult
        return round(min(1.0, raw), 3)

    def _count_warnings(self, events: List[Dict]) -> int:
        """Each HIGH/CRITICAL event is a warning; every 3 mediums is 1 warning."""
        high_events = sum(1 for e in events if e.get("severity") in ("high","critical"))
        med_events  = sum(1 for e in events if e.get("severity") == "medium")
        return high_events + (med_events // 3)
