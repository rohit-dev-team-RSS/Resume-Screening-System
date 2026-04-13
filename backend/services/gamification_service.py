"""
Gamification Service — Points, badges, streaks, leaderboard
"""

from datetime import datetime, timezone, date, timedelta
from typing import List, Optional, Dict, Any

import structlog
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

logger = structlog.get_logger(__name__)

# ─── Badge Definitions ────────────────────────────────────────────────────────
BADGES = {
    "first_interview":   {"name": "First Steps", "description": "Completed your first AI interview", "icon": "🎯", "points": 50, "tier": "bronze"},
    "ai_ready":          {"name": "AI Ready", "description": "Scored 80%+ on a technical interview", "icon": "🤖", "points": 100, "tier": "silver"},
    "top_performer":     {"name": "Top Performer", "description": "Scored 90%+ on any interview", "icon": "⭐", "points": 150, "tier": "gold"},
    "consistent_learner":{"name": "Consistent Learner", "description": "Completed 5 interviews", "icon": "📚", "points": 75, "tier": "silver"},
    "streak_3":          {"name": "On Fire", "description": "3-day practice streak", "icon": "🔥", "points": 60, "tier": "bronze"},
    "streak_7":          {"name": "Week Warrior", "description": "7-day practice streak", "icon": "⚡", "points": 120, "tier": "silver"},
    "streak_30":         {"name": "Unstoppable", "description": "30-day practice streak", "icon": "🏆", "points": 300, "tier": "platinum"},
    "perfect_score":     {"name": "Perfection", "description": "Scored 10/10 on a question", "icon": "💎", "points": 200, "tier": "gold"},
    "speed_demon":       {"name": "Speed Demon", "description": "Answered within 30 seconds with 8+ score", "icon": "⚡", "points": 80, "tier": "silver"},
    "interview_master":  {"name": "Interview Master", "description": "Completed 20 interviews", "icon": "👑", "points": 500, "tier": "legendary"},
    "integrity_pro":     {"name": "Integrity Pro", "description": "Passed 5 sessions with 0 cheating flags", "icon": "🛡️", "points": 100, "tier": "gold"},
}

POINT_RULES = {
    "question_answered":    2,    # Any answer submitted
    "score_5_plus":        5,     # Score >= 5
    "score_7_plus":        10,    # Score >= 7
    "score_9_plus":        20,    # Score >= 9
    "perfect_answer":      30,    # Score = 10
    "interview_completed": 50,    # Full interview done
    "daily_practice":      25,    # First interview of day
    "streak_bonus_daily":  10,    # Streak multiplier per day
}

LEVEL_THRESHOLDS = [
    (0,    "Beginner",     "🌱"),
    (100,  "Junior",       "🔵"),
    (300,  "Developing",   "🟢"),
    (600,  "Competent",    "🟡"),
    (1000, "Proficient",   "🟠"),
    (1500, "Advanced",     "🔴"),
    (2500, "Expert",       "💜"),
    (4000, "Master",       "🏆"),
    (6000, "Legend",       "👑"),
]


class GamificationService:

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.user_gamification
        self.events_col = db.gamification_events

    # ─── Get or Create Profile ────────────────────────────────────────────────
    async def get_profile(self, user_id: str) -> Dict:
        doc = await self.collection.find_one({"user_id": user_id})
        if not doc:
            doc = await self._create_profile(user_id)
        doc["_id"] = str(doc["_id"])
        doc["level_info"] = self._compute_level(doc.get("total_points", 0))
        return doc

    async def _create_profile(self, user_id: str) -> Dict:
        profile = {
            "user_id": user_id,
            "total_points": 0,
            "current_streak": 0,
            "longest_streak": 0,
            "last_practice_date": None,
            "total_interviews": 0,
            "total_questions_answered": 0,
            "average_score": 0.0,
            "badges": [],
            "recent_points": [],
            "clean_sessions": 0,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        result = await self.collection.insert_one(profile)
        profile["_id"] = result.inserted_id
        return profile

    # ─── Award Points ─────────────────────────────────────────────────────────
    async def award_points(
        self,
        user_id: str,
        event_type: str,
        points: int,
        details: Optional[Dict] = None,
    ) -> Dict:
        now = datetime.now(timezone.utc)
        # Log event
        await self.events_col.insert_one({
            "user_id": user_id, "event_type": event_type,
            "points": points, "details": details or {}, "created_at": now,
        })
        # Update profile
        await self.collection.update_one(
            {"user_id": user_id},
            {
                "$inc": {"total_points": points},
                "$push": {"recent_points": {"$each": [{"points": points, "event": event_type, "ts": now.isoformat()}], "$slice": -20}},
                "$set": {"updated_at": now},
            },
            upsert=True,
        )
        return {"awarded": points, "event_type": event_type}

    # ─── Process Interview Result ─────────────────────────────────────────────
    async def process_interview_result(
        self,
        user_id: str,
        interview_score: float,       # 0.0 – 1.0
        questions_answered: int,
        clean_session: bool = True,   # No cheating flags
        answer_details: Optional[List[Dict]] = None,
    ) -> Dict:
        """Award points and badges after a completed interview session."""
        now = datetime.now(timezone.utc)
        profile = await self.get_profile(user_id)
        awarded_points = 0
        new_badges = []
        events_log = []

        # Base completion points
        awarded_points += POINT_RULES["interview_completed"]
        events_log.append({"type": "interview_completed", "pts": POINT_RULES["interview_completed"]})

        # Score-based bonus
        pct = interview_score * 100
        if pct >= 90:
            awarded_points += POINT_RULES["score_9_plus"]
            events_log.append({"type": "score_9_plus", "pts": POINT_RULES["score_9_plus"]})
        elif pct >= 70:
            awarded_points += POINT_RULES["score_7_plus"]
            events_log.append({"type": "score_7_plus", "pts": POINT_RULES["score_7_plus"]})
        elif pct >= 50:
            awarded_points += POINT_RULES["score_5_plus"]
            events_log.append({"type": "score_5_plus", "pts": POINT_RULES["score_5_plus"]})

        # Per-question points
        q_pts = questions_answered * POINT_RULES["question_answered"]
        awarded_points += q_pts
        events_log.append({"type": "questions_answered", "pts": q_pts, "count": questions_answered})

        # Streak update
        streak_result = await self._update_streak(user_id, profile, now)
        awarded_points += streak_result["streak_bonus"]
        if streak_result["streak_bonus"] > 0:
            events_log.append({"type": "streak_bonus", "pts": streak_result["streak_bonus"]})

        # Badge checks
        total_interviews = profile.get("total_interviews", 0) + 1
        total_points_new = profile.get("total_points", 0) + awarded_points

        badge_checks = [
            ("first_interview", total_interviews == 1),
            ("ai_ready", pct >= 80),
            ("top_performer", pct >= 90),
            ("consistent_learner", total_interviews == 5),
            ("interview_master", total_interviews == 20),
            ("perfect_score", pct == 100),
            ("streak_3", streak_result["new_streak"] >= 3),
            ("streak_7", streak_result["new_streak"] >= 7),
            ("streak_30", streak_result["new_streak"] >= 30),
        ]
        existing_badges = set(b.get("id") for b in profile.get("badges", []))
        for badge_id, condition in badge_checks:
            if condition and badge_id not in existing_badges:
                badge_data = {**BADGES[badge_id], "id": badge_id, "earned_at": now.isoformat()}
                new_badges.append(badge_data)
                awarded_points += BADGES[badge_id]["points"]
                existing_badges.add(badge_id)

        # Update running average
        old_avg = profile.get("average_score", 0.0)
        old_count = profile.get("total_interviews", 0)
        new_avg = ((old_avg * old_count) + interview_score) / (old_count + 1)

        # Persist all updates
        update_doc = {
            "$inc": {"total_points": awarded_points, "total_interviews": 1, "total_questions_answered": questions_answered},
            "$set": {"average_score": round(new_avg, 3), "updated_at": now, "current_streak": streak_result["new_streak"]},
        }
        if new_badges:
            update_doc["$push"] = {"badges": {"$each": new_badges}}
        if clean_session:
            update_doc["$inc"]["clean_sessions"] = 1

        await self.collection.update_one({"user_id": user_id}, update_doc, upsert=True)

        return {
            "points_awarded": awarded_points,
            "new_badges": new_badges,
            "streak": streak_result["new_streak"],
            "events_log": events_log,
            "new_total": total_points_new,
            "level_info": self._compute_level(total_points_new),
        }

    async def _update_streak(self, user_id: str, profile: Dict, now: datetime) -> Dict:
        today = now.date()
        last_str = profile.get("last_practice_date")
        current_streak = profile.get("current_streak", 0)
        streak_bonus = 0

        if last_str:
            try:
                last_date = date.fromisoformat(last_str)
                if last_date == today:
                    # Already practiced today, no streak update
                    new_streak = current_streak
                elif last_date == today - timedelta(days=1):
                    # Consecutive day
                    new_streak = current_streak + 1
                    streak_bonus = POINT_RULES["streak_bonus_daily"] * new_streak
                else:
                    # Streak broken
                    new_streak = 1
            except Exception:
                new_streak = 1
        else:
            new_streak = 1

        longest = max(profile.get("longest_streak", 0), new_streak)

        await self.collection.update_one(
            {"user_id": user_id},
            {"$set": {"last_practice_date": today.isoformat(), "current_streak": new_streak, "longest_streak": longest}},
            upsert=True,
        )
        return {"new_streak": new_streak, "streak_bonus": streak_bonus}

    def _compute_level(self, total_points: int) -> Dict:
        level_num, level_name, level_icon = LEVEL_THRESHOLDS[0]
        for i, (threshold, name, icon) in enumerate(LEVEL_THRESHOLDS):
            if total_points >= threshold:
                level_num, level_name, level_icon = i + 1, name, icon
            else:
                break

        # Progress to next level
        current_idx = level_num - 1
        if current_idx < len(LEVEL_THRESHOLDS) - 1:
            current_thresh = LEVEL_THRESHOLDS[current_idx][0]
            next_thresh = LEVEL_THRESHOLDS[current_idx + 1][0]
            progress = round((total_points - current_thresh) / (next_thresh - current_thresh) * 100, 1)
            pts_to_next = next_thresh - total_points
        else:
            progress = 100.0
            pts_to_next = 0

        return {
            "level": level_num,
            "name": level_name,
            "icon": level_icon,
            "progress_pct": progress,
            "points_to_next": pts_to_next,
        }

    # ─── Leaderboard ──────────────────────────────────────────────────────────
    async def get_leaderboard(self, limit: int = 20) -> List[Dict]:
        cursor = self.collection.find().sort("total_points", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        result = []
        for rank, doc in enumerate(docs, 1):
            result.append({
                "rank": rank,
                "user_id": doc["user_id"],
                "total_points": doc.get("total_points", 0),
                "level_info": self._compute_level(doc.get("total_points", 0)),
                "current_streak": doc.get("current_streak", 0),
                "total_interviews": doc.get("total_interviews", 0),
                "average_score": doc.get("average_score", 0.0),
                "badge_count": len(doc.get("badges", [])),
                "top_badge": doc["badges"][-1] if doc.get("badges") else None,
            })
        return result
