"""
Resume Repository — Async MongoDB CRUD for resumes
"""

from datetime import datetime, timezone
from typing import List, Optional

import structlog
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.resume_model import ResumeModel, ResumeStatus

logger = structlog.get_logger(__name__)


class ResumeRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db.resumes

    def _serialize(self, doc: dict) -> dict:
        if doc and "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return doc

    async def create(self, resume_data: dict) -> ResumeModel:
        result = await self.collection.insert_one(resume_data)
        resume_data["_id"] = str(result.inserted_id)
        return ResumeModel(**resume_data)

    async def get_by_id(self, resume_id: str) -> Optional[ResumeModel]:
        try:
            doc = await self.collection.find_one({"_id": ObjectId(resume_id)})
        except Exception:
            return None
        if not doc:
            return None
        return ResumeModel(**self._serialize(doc))

    async def get_by_id_and_user(self, resume_id: str, user_id: str) -> Optional[ResumeModel]:
        try:
            doc = await self.collection.find_one({
                "_id": ObjectId(resume_id),
                "user_id": user_id
            })
        except Exception:
            return None
        if not doc:
            return None
        return ResumeModel(**self._serialize(doc))

    async def get_by_user(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
        status: Optional[ResumeStatus] = None,
    ) -> tuple[List[ResumeModel], int]:
        query = {"user_id": user_id}
        if status:
            query["status"] = status
        total = await self.collection.count_documents(query)
        cursor = self.collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        return [ResumeModel(**self._serialize(d)) for d in docs], total

    async def update_status(
        self, resume_id: str, status: ResumeStatus, error: Optional[str] = None
    ) -> None:
        update = {"status": status, "updated_at": datetime.now(timezone.utc)}
        if error:
            update["parse_error"] = error
        await self.collection.update_one(
            {"_id": ObjectId(resume_id)}, {"$set": update}
        )

    async def update_parsed_data(self, resume_id: str, parsed_data: dict) -> None:
        await self.collection.update_one(
            {"_id": ObjectId(resume_id)},
            {"$set": {
                "parsed_data": parsed_data,
                "status": ResumeStatus.PARSED,
                "updated_at": datetime.now(timezone.utc),
            }},
        )

    async def update(self, resume_id: str, update_data: dict) -> Optional[ResumeModel]:
        update_data["updated_at"] = datetime.now(timezone.utc)
        result = await self.collection.find_one_and_update(
            {"_id": ObjectId(resume_id)},
            {"$set": update_data},
            return_document=True,
        )
        if not result:
            return None
        return ResumeModel(**self._serialize(result))

    async def delete(self, resume_id: str, user_id: str) -> bool:
        result = await self.collection.delete_one({
            "_id": ObjectId(resume_id), "user_id": user_id
        })
        return result.deleted_count > 0

    async def count_by_user(self, user_id: str) -> int:
        return await self.collection.count_documents({"user_id": user_id})

    async def get_multiple_by_ids(self, resume_ids: List[str]) -> List[ResumeModel]:
        object_ids = [ObjectId(rid) for rid in resume_ids if ObjectId.is_valid(rid)]
        cursor = self.collection.find({"_id": {"$in": object_ids}})
        docs = await cursor.to_list(length=len(object_ids))
        return [ResumeModel(**self._serialize(d)) for d in docs]
