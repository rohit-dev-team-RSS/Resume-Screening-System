"""
Dependency Injection — Auth guards, DB access, service instances
"""

from typing import Annotated, Optional

import structlog
from fastapi import Depends, HTTPException, Header, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config.db import get_database
from core.config import settings
from core.security import decode_token, verify_token_type
from models.user_model import UserModel, UserRole
from repositories.user_repo import UserRepository
from repositories.resume_repo import ResumeRepository
from repositories.result_repo import ResultRepository
from services.parser_service import ParserService
from services.ats_service import ATSService
from services.skill_service import SkillService
from services.enhancer_service import EnhancerService
from services.interview_service import InterviewService
from services.github_service import GitHubService
from services.fake_detection_service import FakeDetectionService
from services.pdf_generator_service import PDFGeneratorService

logger = structlog.get_logger(__name__)
security = HTTPBearer(auto_error=False)


# ─── Database ─────────────────────────────────────────────────────────────────
def get_db():
    return get_database()


# ─── Repositories ─────────────────────────────────────────────────────────────
def get_user_repo(db=Depends(get_db)) -> UserRepository:
    return UserRepository(db)


def get_resume_repo(db=Depends(get_db)) -> ResumeRepository:
    return ResumeRepository(db)


def get_result_repo(db=Depends(get_db)) -> ResultRepository:
    return ResultRepository(db)


# ─── Services ─────────────────────────────────────────────────────────────────
def get_parser_service() -> ParserService:
    return ParserService()


def get_ats_service() -> ATSService:
    return ATSService()


def get_skill_service() -> SkillService:
    return SkillService()


def get_enhancer_service() -> EnhancerService:
    return EnhancerService()


def get_interview_service() -> InterviewService:
    return InterviewService()


def get_github_service() -> GitHubService:
    return GitHubService()


def get_fake_detection_service() -> FakeDetectionService:
    return FakeDetectionService()


def get_pdf_service() -> PDFGeneratorService:
    return PDFGeneratorService()


# ─── Auth ─────────────────────────────────────────────────────────────────────
async def get_current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)],
    user_repo: UserRepository = Depends(get_user_repo),
) -> UserModel:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise credentials_exception

    payload = decode_token(credentials.credentials)
    if not payload or not verify_token_type(payload, "access"):
        raise credentials_exception

    user_id = payload.get("sub")
    if not user_id:
        raise credentials_exception

    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.status}. Contact support.",
        )

    return user


async def get_current_active_user(
    current_user: Annotated[UserModel, Depends(get_current_user)]
) -> UserModel:
    return current_user


# ─── Role Guards ──────────────────────────────────────────────────────────────
def require_role(*roles: UserRole):
    async def _check(current_user: UserModel = Depends(get_current_user)) -> UserModel:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {[r.value for r in roles]}",
            )
        return current_user
    return _check


def get_admin_user(current_user: UserModel = Depends(get_current_user)) -> UserModel:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def get_recruiter_or_admin(current_user: UserModel = Depends(get_current_user)) -> UserModel:
    if current_user.role not in (UserRole.RECRUITER, UserRole.ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Recruiter access required")
    return current_user


# ─── Pagination ───────────────────────────────────────────────────────────────
class PaginationParams:
    def __init__(
        self,
        page: int = Query(default=1, ge=1, description="Page number"),
        page_size: int = Query(default=settings.DEFAULT_PAGE_SIZE, ge=1, le=settings.MAX_PAGE_SIZE),
    ):
        self.page = page
        self.page_size = page_size
        self.skip = (page - 1) * page_size

    def to_response_meta(self, total: int) -> dict:
        total_pages = (total + self.page_size - 1) // self.page_size
        return {
            "total": total,
            "page": self.page,
            "page_size": self.page_size,
            "total_pages": total_pages,
            "has_next": self.page < total_pages,
            "has_prev": self.page > 1,
        }
