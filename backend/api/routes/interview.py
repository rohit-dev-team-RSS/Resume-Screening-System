"""
Interview Routes — Mock interview generation
"""

from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import get_current_user, get_resume_repo, get_interview_service
from models.resume_model import ResumeStatus
from models.user_model import UserModel
from repositories.resume_repo import ResumeRepository
from schemas.resume_schema import InterviewRequest, InterviewResponse
from services.interview_service import InterviewService
from utils.validators import validate_object_id

router = APIRouter()


@router.post("/generate", response_model=InterviewResponse)
async def generate_interview(
    payload: InterviewRequest,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    interview_service: InterviewService = Depends(get_interview_service),
):
    """
    Generate a personalized mock interview:
    - Technical questions based on skills
    - Behavioral questions (STAR format)
    - Situational problem-solving scenarios
    - Preparation tips
    """
    validate_object_id(payload.resume_id, "resume_id")
    resume = await resume_repo.get_by_id_and_user(payload.resume_id, str(current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")
    if resume.status != ResumeStatus.PARSED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Resume must be parsed before generating an interview.",
        )
    return await interview_service.generate_interview(
        resume=resume,
        job_description=payload.job_description,
        job_title=payload.job_title,
        difficulty=payload.difficulty,
        interview_type=payload.interview_type,
        num_questions=payload.num_questions,
    )
