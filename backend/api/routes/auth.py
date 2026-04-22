"""
Auth Routes — Signup, Login, Refresh, Me, Logout, Change Password
"""

from datetime import datetime, timezone
import httpx
import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from api.deps import get_current_user, get_user_repo
from core.security import (
    create_access_token, create_refresh_token,
    decode_token, hash_password, verify_password, verify_token_type
)
from fastapi.encoders import jsonable_encoder
from core.config import settings
from models.user_model import UserModel, UserStatus
from repositories.user_repo import UserRepository
from schemas.user_schema import (
    SignupRequest, LoginRequest, RefreshTokenRequest,
    TokenResponse, UserPublicResponse, MessageResponse,
    ChangePasswordRequest, UpdateProfileRequest
)
from google.oauth2 import id_token
from google.auth.transport import requests

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

# ─── POST /auth/google ────────────────────────────────────────────────────────
@router.post("/google")
async def google_auth(
    payload: dict, # Expecting {"token": "...", "role": "..."}
    background_tasks: BackgroundTasks,
    user_repo: UserRepository = Depends(get_user_repo),
):
    """Authenticate via Google Access Token."""
    google_token = payload.get("token")
    selected_role = payload.get("role", "candidate")

    if not google_token:
        raise HTTPException(status_code=400, detail="Google token is missing")

    try:
        idinfo = id_token.verify_oauth2_token(
            google_token,
            requests.Request()
        )
    except Exception as e:
        print("GOOGLE ERROR:", str(e))
        raise HTTPException(status_code=401, detail=str(e))

    email = idinfo.get("email").lower()
    full_name = idinfo.get("name")
    profile_pic = idinfo.get("picture")

    # 2. Check if user exists in MongoDB
    user = await user_repo.get_by_email(email)

    if not user:
        # Create new user for first-time Google sign-in
        user_data = {
            "email": email,
            "full_name": full_name,
            "role": selected_role,
            "status": UserStatus.ACTIVE,
            "profile_picture": profile_pic,
            "auth_method": "google", # Good to track how they joined
            "total_resumes": 0,
            "total_ats_checks": 0,
        }
        user = await user_repo.create(user_data)
        logger.info("New Google user registered", user_id=str(user.id), email=email)
    else:
        # User exists, just update their last login
        background_tasks.add_task(user_repo.update_last_login, str(user.id))
        logger.info("Existing Google user logged in", user_id=str(user.id), email=email)

    # 3. Build standard CareerAI tokens
    token_data = _build_token_response(user)

    # 4. Save refresh token for rotation logic
    await user_repo.update(str(user.id), {"refresh_token": token_data.refresh_token})

    # 5. Build Response with Cookies (Same as your login/signup)
    response = JSONResponse(content=jsonable_encoder(token_data))
    
    cookie_settings = {
        "httponly": True,
        # "secure": settings.ENV == "production",
        "secure": False,
        "samesite": "lax"
    }
    
    response.set_cookie(key="access_token", value=token_data.access_token, **cookie_settings)
    response.set_cookie(key="refresh_token", value=token_data.refresh_token, **cookie_settings)

    return response

# ─── POST /auth/signup ────────────────────────────────────────────────────────
@router.post("/signup", status_code=status.HTTP_201_CREATED)
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

    logger.info("New user registered", user_id=str(user.id), email=user.email)

    # Generate tokens
    token_data = _build_token_response(user)

    # Save refresh token in DB (IMPORTANT)
    await user_repo.update(str(user.id), {
        "refresh_token": token_data.refresh_token
    })

    # Create response
    response = JSONResponse(content=jsonable_encoder(token_data))

    # Set cookies
    response.set_cookie(
        key="access_token",
        value=token_data.access_token,
        httponly=True,
        secure=False, 
        samesite="lax"
    )

    response.set_cookie(
        key="refresh_token",
        value=token_data.refresh_token,
        httponly=True,
        secure=False,
        samesite="lax"
    )

    return response


# ─── POST /auth/login ─────────────────────────────────────────────────────────
@router.post("/login")
async def login(
    payload: LoginRequest,
    background_tasks: BackgroundTasks,
    user_repo: UserRepository = Depends(get_user_repo),
):
    """Authenticate user and return JWT tokens."""

    user = await user_repo.get_by_email(payload.email.lower())
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
    )

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

    # Update last login (background)
    background_tasks.add_task(user_repo.update_last_login, str(user.id))

    logger.info("User logged in", user_id=str(user.id), email=user.email)

    # Generate tokens
    token_data = _build_token_response(user)

    # Save refresh token in DB (IMPORTANT)
    await user_repo.update(str(user.id), {
        "refresh_token": token_data.refresh_token
    })

    # Create response
    response = JSONResponse(content=jsonable_encoder(token_data))

    # Set cookies
    response.set_cookie(
        key="access_token",
        value=token_data.access_token,
        httponly=True,
        secure=False,
        samesite="lax"
    )

    response.set_cookie(
        key="refresh_token",
        value=token_data.refresh_token,
        httponly=True,
        secure=False,
        samesite="lax"
    )

    return response


# ─── POST /auth/refresh ───────────────────────────────────────────────────────
@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    payload: RefreshTokenRequest,
    user_repo: UserRepository = Depends(get_user_repo),
):
    token_data = decode_token(payload.refresh_token)

    if not token_data or not verify_token_type(token_data, "refresh"):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired refresh token"
        )

    user = await user_repo.get_by_id(token_data["sub"])

    if not user or user.refresh_token != payload.refresh_token:
        raise HTTPException(
            status_code=401,
            detail="Invalid or reused refresh token"
        )

    # NEW TOKENS
    new_tokens = _build_token_response(user)

    # ROTATION (IMPORTANT)
    await user_repo.update(str(user.id), {
        "refresh_token": new_tokens.refresh_token
    })

    # response = JSONResponse(content=new_tokens.model_dump())
    response = JSONResponse(content=jsonable_encoder(new_tokens))

    response.set_cookie(
        key="access_token",
        value=new_tokens.access_token,
        httponly=True,
        secure=False,
        samesite="lax"
    )

    response.set_cookie(
        key="refresh_token",
        value=new_tokens.refresh_token,
        httponly=True,
        secure=False,
        samesite="lax"
    )

    return response

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

@router.post("/logout")
async def logout(
    current_user: UserModel = Depends(get_current_user),
    user_repo: UserRepository = Depends(get_user_repo),
):
    await user_repo.update(str(current_user.id), {
        "refresh_token": None
    })

    response = JSONResponse(content={"message": "Logged out successfully"})

    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")

    return response