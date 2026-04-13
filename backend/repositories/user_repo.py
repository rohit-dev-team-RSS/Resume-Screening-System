"""
User Repository — Async MongoDB CRUD operations for users
"""

from datetime import datetime, timezone
from typing import List, Optional

import structlog
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from models.user_model import UserModel, UserRole, UserStatus

logger = structlog.get_logger(__name__)


class UserRepository:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.collection = db.users

    def _serialize(self, doc: dict) -> dict:
        if doc and "_id" in doc:
            doc["_id"] = str(doc["_id"])
        return doc

    async def create(self, user_data: dict) -> UserModel:
        result = await self.collection.insert_one(user_data)
        user_data["_id"] = str(result.inserted_id)
        return UserModel(**user_data)

    async def get_by_id(self, user_id: str) -> Optional[UserModel]:
        try:
            doc = await self.collection.find_one({"_id": ObjectId(user_id)})
        except Exception:
            return None
        if not doc:
            return None
        return UserModel(**self._serialize(doc))

    async def get_by_email(self, email: str) -> Optional[UserModel]:
        doc = await self.collection.find_one({"email": email.lower()})
        if not doc:
            return None
        return UserModel(**self._serialize(doc))

    async def update(self, user_id: str, update_data: dict) -> Optional[UserModel]:
        update_data["updated_at"] = datetime.now(timezone.utc)
        result = await self.collection.find_one_and_update(
            {"_id": ObjectId(user_id)},
            {"$set": update_data},
            return_document=True,
        )
        if not result:
            return None
        return UserModel(**self._serialize(result))

    async def update_last_login(self, user_id: str) -> None:
        await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"last_login": datetime.now(timezone.utc)}}
        )

    async def increment_counter(self, user_id: str, field: str, amount: int = 1) -> None:
        await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$inc": {field: amount}}
        )

    async def delete(self, user_id: str) -> bool:
        result = await self.collection.delete_one({"_id": ObjectId(user_id)})
        return result.deleted_count > 0

    async def list_users(
        self,
        role: Optional[UserRole] = None,
        status: Optional[UserStatus] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[List[UserModel], int]:
        query = {}
        if role:
            query["role"] = role
        if status:
            query["status"] = status

        total = await self.collection.count_documents(query)
        cursor = self.collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        users = [UserModel(**self._serialize(d)) for d in docs]
        return users, total

    async def email_exists(self, email: str) -> bool:
        count = await self.collection.count_documents({"email": email.lower()})
        return count > 0

    async def get_platform_user_stats(self) -> dict:
        pipeline = [
            {"$group": {
                "_id": "$role",
                "count": {"$sum": 1},
                "active": {"$sum": {"$cond": [{"$eq": ["$status", "active"]}, 1, 0]}},
            }},
        ]
        cursor = self.collection.aggregate(pipeline)
        stats = {}
        async for doc in cursor:
            stats[doc["_id"]] = {"total": doc["count"], "active": doc["active"]}
        total = await self.collection.count_documents({})
        return {"by_role": stats, "total_users": total}
