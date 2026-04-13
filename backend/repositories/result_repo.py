"""
Result Repository — ATS results and Job Descriptions
"""

from datetime import datetime, timezone
from typing import List, Optional

import structlog
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.result_model import ATSResultModel, JobDescriptionModel

logger = structlog.get_logger(__name__)


class ResultRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.results = db.results
        self.job_descriptions = db.job_descriptions

    def _serialize(self, doc: dict) -> dict:
        if doc and "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return doc

    # ─── Job Description ──────────────────────────────────────────────────────
    async def create_job_description(self, jd_data: dict) -> JobDescriptionModel:
        result = await self.job_descriptions.insert_one(jd_data)
        jd_data["_id"] = str(result.inserted_id)
        return JobDescriptionModel(**jd_data)

    async def get_jd_by_id(self, jd_id: str) -> Optional[JobDescriptionModel]:
        try:
            doc = await self.job_descriptions.find_one({"_id": ObjectId(jd_id)})
        except Exception:
            return None
        if not doc:
            return None
        return JobDescriptionModel(**self._serialize(doc))

    # ─── ATS Results ──────────────────────────────────────────────────────────
    async def create_result(self, result_data: dict) -> ATSResultModel:
        # Upsert based on resume+jd pair
        existing = await self.results.find_one({
            "resume_id": result_data["resume_id"],
            "job_description_id": result_data["job_description_id"],
        })
        if existing:
            result_data["updated_at"] = datetime.now(timezone.utc)
            await self.results.replace_one({"_id": existing["_id"]}, result_data)
            result_data["_id"] = str(existing["_id"])
        else:
            res = await self.results.insert_one(result_data)
            result_data["_id"] = str(res.inserted_id)
        return ATSResultModel(**result_data)

    async def get_result_by_id(self, result_id: str) -> Optional[ATSResultModel]:
        try:
            doc = await self.results.find_one({"_id": ObjectId(result_id)})
        except Exception:
            return None
        if not doc:
            return None
        return ATSResultModel(**self._serialize(doc))

    async def get_results_by_user(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
        min_score: Optional[float] = None,
    ) -> tuple[List[ATSResultModel], int]:
        query = {"user_id": user_id}
        if min_score is not None:
            query["final_score"] = {"$gte": min_score}
        total = await self.results.count_documents(query)
        cursor = self.results.find(query).sort("created_at", -1).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [ATSResultModel(**self._serialize(d)) for d in docs], total

    async def get_results_by_resume(self, resume_id: str) -> List[ATSResultModel]:
        cursor = self.results.find({"resume_id": resume_id}).sort("created_at", -1)
        docs = await cursor.to_list(length=50)
        return [ATSResultModel(**self._serialize(d)) for d in docs]

    async def get_top_candidates(
        self,
        job_description_id: str,
        limit: int = 20,
    ) -> List[ATSResultModel]:
        cursor = self.results.find(
            {"job_description_id": job_description_id}
        ).sort("final_score", -1).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [ATSResultModel(**self._serialize(d)) for d in docs]

    async def get_analytics_summary(self, user_id: Optional[str] = None) -> dict:
        match = {"user_id": user_id} if user_id else {}
        pipeline = [
            {"$match": match},
            {"$group": {
                "_id": None,
                "total_checks": {"$sum": 1},
                "avg_score": {"$avg": "$final_score"},
                "max_score": {"$max": "$final_score"},
                "min_score": {"$min": "$final_score"},
                "strong_matches": {
                    "$sum": {"$cond": [{"$gte": ["$final_score", 0.8]}, 1, 0]}
                },
                "good_matches": {
                    "$sum": {"$cond": [
                        {"$and": [
                            {"$gte": ["$final_score", 0.6]},
                            {"$lt": ["$final_score", 0.8]}
                        ]}, 1, 0
                    ]}
                },
                "poor_matches": {
                    "$sum": {"$cond": [{"$lt": ["$final_score", 0.4]}, 1, 0]}
                },
            }},
        ]
        cursor = self.results.aggregate(pipeline)
        result = await cursor.to_list(length=1)
        return result[0] if result else {}
