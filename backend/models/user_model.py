"""
MongoDB Document Models — User
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field
from bson import ObjectId


class UserRole(str, Enum):
    CANDIDATE = "candidate"
    RECRUITER = "recruiter"
    ADMIN = "admin"


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class UserModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    email: EmailStr
    hashed_password: str
    full_name: str
    role: UserRole = UserRole.CANDIDATE
    status: UserStatus = UserStatus.ACTIVE
    profile_picture: Optional[str] = None
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_username: Optional[str] = None
    total_resumes: int = 0
    total_ats_checks: int = 0
    last_login: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
