"""
Enhance Routes — AI-powered resume enhancement
"""

from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import get_current_user, get_resume_repo, get_enhancer_service
from models.resume_model import ResumeStatus
from models.user_model import UserModel
from repositories.resume_repo import ResumeRepository
from schemas.resume_schema import EnhanceResumeRequest, EnhanceResumeResponse
from services.enhancer_service import EnhancerService
from utils.validators import validate_object_id

router = APIRouter()


@router.post("/resume", response_model=EnhanceResumeResponse)
async def enhance_resume(
    payload: EnhanceResumeRequest,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    enhancer: EnhancerService = Depends(get_enhancer_service),
):
    """
    AI-powered resume enhancement:
    - Rewrites professional summary
    - Upgrades experience bullets with action verbs
    - Injects missing ATS keywords
    - Provides formatting suggestions
    """
    validate_object_id(payload.resume_id, "resume_id")
    resume = await resume_repo.get_by_id_and_user(payload.resume_id, str(current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")
    if resume.status != ResumeStatus.PARSED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Resume must be parsed before enhancement.",
        )
    return await enhancer.enhance_resume(
        resume=resume,
        job_description=payload.job_description,
        target_role=payload.target_role,
        enhancement_areas=payload.enhancement_areas,
        tone=payload.tone,
    )
