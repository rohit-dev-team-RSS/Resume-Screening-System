"""
Interview Analytics Service — Aggregated performance insights
Extends existing result/analytics collections with interview-specific metrics
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Any

import structlog
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = structlog.get_logger(__name__)


class InterviewAnalyticsService:

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.sessions = db.interview_sessions
        self.answers = db.interview_answers

    async def record_session(
        self,
        user_id: str,
        session_id: str,
        job_title: str,
        difficulty: str,
        interview_type: str,
        questions: List[Dict],
        avg_score: float,
        duration_seconds: int,
        cheating_score: float = 0.0,
    ) -> None:
        doc = {
            "user_id": user_id,
            "session_id": session_id,
            "job_title": job_title,
            "difficulty": difficulty,
            "interview_type": interview_type,
            "total_questions": len(questions),
            "avg_score": round(avg_score, 3),
            "duration_seconds": duration_seconds,
            "cheating_score": cheating_score,
            "question_types": {
                "technical": sum(1 for q in questions if q.get("type") == "technical"),
                "behavioral": sum(1 for q in questions if q.get("type") == "behavioral"),
                "situational": sum(1 for q in questions if q.get("type") == "situational"),
            },
            "created_at": datetime.now(timezone.utc),
        }
        await self.sessions.insert_one(doc)
        logger.info("Session recorded", session_id=session_id, avg_score=avg_score)

    async def record_answer(
        self,
        user_id: str,
        session_id: str,
        question: str,
        category: str,
        question_type: str,
        answer: str,
        feedback: Dict,
        time_taken: int,
    ) -> None:
        doc = {
            "user_id": user_id,
            "session_id": session_id,
            "question": question,
            "category": category,
            "question_type": question_type,
            "answer_length": len(answer),
            "score": feedback.get("score", 0),
            "grade": feedback.get("grade", "N/A"),
            "confidence_level": feedback.get("confidence_level", "medium"),
            "time_taken_seconds": time_taken,
            "criteria_scores": feedback.get("criteria_scores", {}),
            "created_at": datetime.now(timezone.utc),
        }
        await self.answers.insert_one(doc)

    async def get_user_analytics(self, user_id: str, days: int = 90) -> Dict[str, Any]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        query = {"user_id": user_id, "created_at": {"$gte": cutoff}}

        # Session summary
        session_pipeline = [
            {"$match": query},
            {"$group": {
                "_id": None,
                "total_sessions": {"$sum": 1},
                "avg_score": {"$avg": "$avg_score"},
                "best_score": {"$max": "$avg_score"},
                "total_questions": {"$sum": "$total_questions"},
                "avg_duration": {"$avg": "$duration_seconds"},
                "technical_sessions": {"$sum": {"$cond": [{"$eq": ["$interview_type", "technical"]}, 1, 0]}},
                "behavioral_sessions": {"$sum": {"$cond": [{"$eq": ["$interview_type", "behavioral"]}, 1, 0]}},
            }}
        ]
        sessions_cursor = self.sessions.aggregate(session_pipeline)
        session_summary = await sessions_cursor.to_list(length=1)
        summary = session_summary[0] if session_summary else {
            "total_sessions": 0, "avg_score": 0, "best_score": 0,
            "total_questions": 0, "avg_duration": 0,
        }

        # Score trend
        trend_pipeline = [
            {"$match": {"user_id": user_id, "created_at": {"$gte": cutoff}}},
            {"$project": {
                "date": {"$dateToString": {"format": "%b %d", "date": "$created_at"}},
                "avg_score": 1, "difficulty": 1,
            }},
            {"$sort": {"created_at": 1}},
            {"$limit": 30},
        ]
        trend_cursor = self.sessions.aggregate(trend_pipeline)
        trend = await trend_cursor.to_list(length=30)

        # Category performance
        cat_pipeline = [
            {"$match": {"user_id": user_id, "created_at": {"$gte": cutoff}}},
            {"$group": {
                "_id": "$category",
                "avg_score": {"$avg": "$score"},
                "count": {"$sum": 1},
            }},
            {"$sort": {"avg_score": 1}},
            {"$limit": 10},
        ]
        cat_cursor = self.answers.aggregate(cat_pipeline)
        categories = await cat_cursor.to_list(length=10)

        # Type performance
        type_pipeline = [
            {"$match": {"user_id": user_id, "created_at": {"$gte": cutoff}}},
            {"$group": {
                "_id": "$question_type",
                "avg_score": {"$avg": "$score"},
                "count": {"$sum": 1},
            }},
        ]
        type_cursor = self.answers.aggregate(type_pipeline)
        types = await type_cursor.to_list(length=5)

        # Confidence distribution
        conf_pipeline = [
            {"$match": {"user_id": user_id, "created_at": {"$gte": cutoff}}},
            {"$group": {
                "_id": "$confidence_level",
                "count": {"$sum": 1},
            }},
        ]
        conf_cursor = self.answers.aggregate(conf_pipeline)
        confidence = await conf_cursor.to_list(length=5)

        return {
            "period_days": days,
            "summary": {
                "total_sessions": summary.get("total_sessions", 0),
                "avg_score": round(summary.get("avg_score", 0) or 0, 2),
                "best_score": round(summary.get("best_score", 0) or 0, 2),
                "total_questions": summary.get("total_questions", 0),
                "avg_duration_minutes": round((summary.get("avg_duration", 0) or 0) / 60, 1),
            },
            "score_trend": [{"date": t["date"], "avg_score": round(t["avg_score"], 2)} for t in trend],
            "category_performance": [
                {"category": c["_id"], "avg_score": round(c["avg_score"], 2), "attempts": c["count"]}
                for c in categories if c["_id"]
            ],
            "type_performance": [
                {"type": t["_id"], "avg_score": round(t["avg_score"], 2), "count": t["count"]}
                for t in types if t["_id"]
            ],
            "confidence_distribution": {c["_id"]: c["count"] for c in confidence if c["_id"]},
            "weak_areas": [c for c in categories if (c.get("avg_score") or 0) < 6.5],
            "strong_areas": [c for c in sorted(categories, key=lambda x: x.get("avg_score", 0), reverse=True)[:3]],
        }

    async def get_platform_stats(self) -> Dict:
        total = await self.sessions.count_documents({})
        pipeline = [
            {"$group": {
                "_id": None,
                "avg_score": {"$avg": "$avg_score"},
                "total_questions": {"$sum": "$total_questions"},
            }}
        ]
        cursor = self.sessions.aggregate(pipeline)
        result = await cursor.to_list(length=1)
        stats = result[0] if result else {}
        return {
            "total_interview_sessions": total,
            "platform_avg_score": round(stats.get("avg_score", 0) or 0, 2),
            "total_questions_answered": stats.get("total_questions", 0),
        }
