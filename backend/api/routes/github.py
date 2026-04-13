"""
GitHub Routes — Profile analysis
"""

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import get_current_user, get_github_service
from models.user_model import UserModel
from services.github_service import GitHubService
from utils.validators import is_valid_github_username

router = APIRouter()


class GitHubAnalyzeRequest(BaseModel):
    username: str = Field(min_length=1, max_length=39)
    save_to_profile: bool = False


@router.post("/analyze")
async def analyze_github(
    payload: GitHubAnalyzeRequest,
    current_user: UserModel = Depends(get_current_user),
    github_service: GitHubService = Depends(get_github_service),
):
    """
    Analyze a GitHub profile:
    - Repository stats (stars, forks)
    - Language distribution
    - Contribution score
    - Tech stack detection
    - Hirability signals
    """
    if not is_valid_github_username(payload.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid GitHub username: '{payload.username}'",
        )
    try:
        result = await github_service.analyze_profile(payload.username)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))

    return {"success": True, "data": result}


@router.get("/profile/{username}")
async def get_github_profile(
    username: str,
    current_user: UserModel = Depends(get_current_user),
    github_service: GitHubService = Depends(get_github_service),
):
    """Fetch public GitHub profile and basic stats."""
    if not is_valid_github_username(username):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid GitHub username.")
    try:
        result = await github_service.analyze_profile(username)
        return {"profile": result["profile"], "tech_stack": result["tech_stack"]}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
