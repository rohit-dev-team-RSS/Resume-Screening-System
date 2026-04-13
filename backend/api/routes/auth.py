"""
Auth Routes — Signup, Login, Refresh, Me, Logout, Change Password
"""

from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from api.deps import get_current_user, get_user_repo
from core.security import (
    create_access_token, create_refresh_token,
    decode_token, hash_password, verify_password, verify_token_type
)
from core.config import settings
from models.user_model import UserModel, UserStatus
from repositories.user_repo import UserRepository
from schemas.user_schema import (
    SignupRequest, LoginRequest, RefreshTokenRequest,
    TokenResponse, UserPublicResponse, MessageResponse,
    ChangePasswordRequest, UpdateProfileRequest
)

logger = structlog.get_logger(__name__)
router = APIRouter()


def _user_to_public(user: UserModel) -> UserPublicResponse:
    return UserPublicResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        status=user.status,
        profile_picture=user.profile_picture,
        phone=user.phone,
        linkedin_url=user.linkedin_url,
        github_username=user.github_username,
        total_resumes=user.total_resumes,
        total_ats_checks=user.total_ats_checks,
        last_login=user.last_login,
        created_at=user.created_at,
    )


def _build_token_response(user: UserModel) -> TokenResponse:
    extra = {"role": user.role, "email": user.email}
    access_token = create_access_token(str(user.id), extra_claims=extra)
    refresh_token = create_refresh_token(str(user.id))
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=_user_to_public(user),
    )


# ─── POST /auth/signup ────────────────────────────────────────────────────────
@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(
    payload: SignupRequest,
    user_repo: UserRepository = Depends(get_user_repo),
):
    """Register a new user account."""
    if await user_repo.email_exists(payload.email.lower()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    user_data = {
        "email": payload.email.lower(),
        "hashed_password": hash_password(payload.password),
        "full_name": payload.full_name,
        "role": payload.role,
        "phone": payload.phone,
        "linkedin_url": payload.linkedin_url,
        "github_username": payload.github_username,
        "status": UserStatus.ACTIVE,
        "total_resumes": 0,
        "total_ats_checks": 0,
    }
    user = await user_repo.create(user_data)
    logger.info("New user registered", user_id=str(user.id), email=user.email, role=user.role)
    return _build_token_response(user)


# ─── POST /auth/login ─────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    background_tasks: BackgroundTasks,
    user_repo: UserRepository = Depends(get_user_repo),
):
    """Authenticate user and return JWT tokens."""
    user = await user_repo.get_by_email(payload.email.lower())
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    if user.status == UserStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account suspended. Contact support.",
        )
    background_tasks.add_task(user_repo.update_last_login, str(user.id))
    logger.info("User logged in", user_id=str(user.id), email=user.email)
    return _build_token_response(user)


# ─── POST /auth/refresh ───────────────────────────────────────────────────────
@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    payload: RefreshTokenRequest,
    user_repo: UserRepository = Depends(get_user_repo),
):
    """Refresh access token using a valid refresh token."""
    token_data = decode_token(payload.refresh_token)
    if not token_data or not verify_token_type(token_data, "refresh"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token.",
        )
    user = await user_repo.get_by_id(token_data["sub"])
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return _build_token_response(user)


# ─── GET /auth/me ─────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserPublicResponse)
async def get_me(current_user: UserModel = Depends(get_current_user)):
    """Get the currently authenticated user's profile."""
    return _user_to_public(current_user)


# ─── PUT /auth/me ─────────────────────────────────────────────────────────────
@router.put("/me", response_model=UserPublicResponse)
async def update_profile(
    payload: UpdateProfileRequest,
    current_user: UserModel = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
):
    """Update authenticated user's profile."""
    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update.")
    updated = await user_repo.update(str(current_user.id), update_data)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return _user_to_public(updated)


# ─── POST /auth/change-password ───────────────────────────────────────────────
@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: UserModel = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
):
    """Change user password after verifying current password."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    new_hash = hash_password(payload.new_password)
    await user_repo.update(str(current_user.id), {"hashed_password": new_hash})
    logger.info("Password changed", user_id=str(current_user.id))
    return MessageResponse(message="Password changed successfully.")


# ─── DELETE /auth/me ──────────────────────────────────────────────────────────
@router.delete("/me", response_model=MessageResponse)
async def deactivate_account(
    current_user: UserModel = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
):
    """Deactivate (soft delete) current user's account."""
    await user_repo.update(str(current_user.id), {"status": UserStatus.INACTIVE})
    return MessageResponse(message="Account deactivated successfully.")
