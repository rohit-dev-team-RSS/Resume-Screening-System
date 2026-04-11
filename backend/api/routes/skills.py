"""
Skills Routes — Skill gap analysis & learning path
"""

from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import get_current_user, get_resume_repo, get_skill_service
from models.resume_model import ResumeStatus
from models.user_model import UserModel
from repositories.resume_repo import ResumeRepository
from schemas.ats_schema import SkillAnalysisRequest, SkillAnalysisResponse
from services.skill_service import SkillService
from utils.validators import validate_object_id

router = APIRouter()


@router.post("/analyze", response_model=SkillAnalysisResponse)
async def analyze_skills(
    payload: SkillAnalysisRequest,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    skill_service: SkillService = Depends(get_skill_service),
):
    """Perform full skill gap analysis and generate a personalized learning path."""
    validate_object_id(payload.resume_id, "resume_id")
    resume = await resume_repo.get_by_id_and_user(payload.resume_id, str(current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")
    if resume.status != ResumeStatus.PARSED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Resume must be parsed before skill analysis.",
        )
    return await skill_service.analyze_skills(resume, payload.target_role, payload.industry)


@router.get("/market-demand")
async def get_market_demand(current_user: UserModel = Depends(get_current_user)):
    """Get current market demand scores for top technical skills."""
    from  services.skill_service import MARKET_DEMAND
    sorted_skills = sorted(MARKET_DEMAND.items(), key=lambda x: x[1], reverse=True)
    return {
        "skills": [
            {"skill": k, "demand_score": v, "demand_level": (
                "very_high" if v >= 0.9 else "high" if v >= 0.8 else "medium" if v >= 0.7 else "low"
            )}
            for k, v in sorted_skills
        ],
        "total": len(sorted_skills),
    }
