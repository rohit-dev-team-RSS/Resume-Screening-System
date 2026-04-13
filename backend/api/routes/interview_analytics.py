"""
Interview Analytics Routes — Performance tracking endpoints
Add to main.py: include_router(interview_analytics_router, prefix=f"{prefix}/interview-analytics", tags=["Interview Analytics"])
"""

from fastapi import APIRouter, Depends, Query
# from api.deps import get_current_user, get_database
from api.deps import get_current_user
from config.db import get_database
from models.user_model import UserModel
from services.analytics_service import InterviewAnalyticsService

router = APIRouter()


def get_analytics_service(db=Depends(get_database)) -> InterviewAnalyticsService:
    return InterviewAnalyticsService(db)


@router.get("/my-performance")
async def get_my_interview_performance(
    days: int = Query(default=90, ge=7, le=365),
    current_user: UserModel = Depends(get_current_user),
    svc: InterviewAnalyticsService = Depends(get_analytics_service),
):
    """Get comprehensive interview performance analytics for the current user."""
    return await svc.get_user_analytics(str(current_user.id), days=days)


@router.get("/platform-stats")
async def get_platform_interview_stats(
    current_user: UserModel = Depends(get_current_user),
    svc: InterviewAnalyticsService = Depends(get_analytics_service),
):
    """Platform-wide interview statistics."""
    return await svc.get_platform_stats()
