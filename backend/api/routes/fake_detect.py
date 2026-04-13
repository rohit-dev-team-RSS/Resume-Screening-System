"""
Fake Detection Routes — Resume authenticity analysis
"""

from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import get_current_user, get_resume_repo, get_fake_detection_service
from models.resume_model import ResumeStatus
from models.user_model import UserModel
from repositories.resume_repo import ResumeRepository
from services.fake_detection_service import FakeDetectionService
from utils.validators import validate_object_id

router = APIRouter()


class FakeDetectRequest(BaseModel):
    resume_id: str
    github_username: Optional[str] = None


@router.post("/analyze")
async def detect_fake_experience(
    payload: FakeDetectRequest,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    fake_service: FakeDetectionService = Depends(get_fake_detection_service),
):
    """
    Analyze resume authenticity:
    - Date consistency checks
    - Skill timeline validation
    - Vague language detection
    - Career progression sanity
    - GitHub correlation (optional)
    - Education verification signals
    """
    validate_object_id(payload.resume_id, "resume_id")
    resume = await resume_repo.get_by_id_and_user(payload.resume_id, str(current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")
    if resume.status != ResumeStatus.PARSED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Resume must be parsed first.",
        )

    github_data = None
    if payload.github_username:
        try:
            from services.github_service import GitHubService
            gh = GitHubService()
            github_data = await gh.analyze_profile(payload.github_username)
        except Exception:
            pass  # GitHub optional — don't fail the request

    result = await fake_service.analyze(resume, github_data)
    return {"success": True, "data": result}
