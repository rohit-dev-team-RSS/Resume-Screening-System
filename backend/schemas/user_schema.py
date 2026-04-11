"""
Pydantic v2 Schemas — User Auth & Profile
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from models.user_model import UserRole, UserStatus


# ─── Request Schemas ──────────────────────────────────────────────────────────
class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=100)
    role: UserRole = UserRole.CANDIDATE
    phone: Optional[str] = Field(default=None, pattern=r"^\+?[\d\s\-()]{7,20}$")
    linkedin_url: Optional[str] = None
    github_username: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        if not any(c in "!@#$%^&*()_+-=[]{}|;':\",./<>?" for c in v):
            raise ValueError("Password must contain at least one special character")
        return v

    @field_validator("full_name")
    @classmethod
    def name_must_have_space(cls, v: str) -> str:
        v = v.strip()
        if len(v.split()) < 2:
            raise ValueError("Please provide your full name (first and last)")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    phone: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_username: Optional[str] = None
    profile_picture: Optional[str] = None


# ─── Response Schemas ─────────────────────────────────────────────────────────
class UserPublicResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    status: UserStatus
    profile_picture: Optional[str]
    phone: Optional[str]
    linkedin_url: Optional[str]
    github_username: Optional[str]
    total_resumes: int
    total_ats_checks: int
    last_login: Optional[datetime]
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserPublicResponse


class MessageResponse(BaseModel):
    success: bool = True
    message: str


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool
