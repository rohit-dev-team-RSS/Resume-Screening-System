"""
Recruiter Dashboard Routes — Candidate ranking, filtering, pipeline management
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status

from api.deps import get_current_user, get_recruiter_or_admin, get_result_repo, get_resume_repo
from models.user_model import UserModel
from repositories.result_repo import ResultRepository
from repositories.resume_repo import ResumeRepository

router = APIRouter()


class RankCandidatesRequest(BaseModel):
    job_description_id: str
    min_score: float = Field(default=0.0, ge=0.0, le=1.0)
    max_results: int = Field(default=20, ge=1, le=100)
    filter_recommendation: Optional[str] = None  # strong_match | good_match | etc.


class CandidateNote(BaseModel):
    resume_id: str
    note: str = Field(max_length=1000)
    status: str = Field(
        default="reviewed",
        pattern="^(shortlisted|rejected|interview_scheduled|offer_made|reviewed)$"
    )


# ─── POST /recruiter/rank ─────────────────────────────────────────────────────
@router.post("/rank")
async def rank_candidates(
    payload: RankCandidatesRequest,
    current_user: UserModel = Depends(get_recruiter_or_admin),
    result_repo: ResultRepository = Depends(get_result_repo),
):
    """
    Rank all candidates for a job description by ATS score.
    Recruiter/Admin only.
    """
    results = await result_repo.get_top_candidates(
        payload.job_description_id,
        limit=payload.max_results,
    )
    candidates = []
    for rank, result in enumerate(results, 1):
        if result.final_score < payload.min_score:
            continue
        if payload.filter_recommendation and result.recommendation != payload.filter_recommendation:
            continue
        candidates.append({
            "rank": rank,
            "resume_id": result.resume_id,
            "final_score": result.final_score,
            "bert_score": result.bert_score,
            "tfidf_score": result.tfidf_score,
            "recommendation": result.recommendation,
            "matched_skills": result.matched_skills,
            "missing_skills": result.missing_skills[:5],
            "matched_keywords_count": len(result.matched_keywords),
            "authenticity_score": result.authenticity_score,
            "red_flags_count": len(result.red_flags),
            "scored_at": result.created_at,
        })

    return {
        "job_description_id": payload.job_description_id,
        "total_candidates": len(candidates),
        "candidates": candidates,
        "summary": {
            "strong_matches": sum(1 for c in candidates if c["recommendation"] == "strong_match"),
            "good_matches": sum(1 for c in candidates if c["recommendation"] == "good_match"),
            "partial_matches": sum(1 for c in candidates if c["recommendation"] == "partial_match"),
            "poor_matches": sum(1 for c in candidates if c["recommendation"] == "poor_match"),
            "average_score": round(
                sum(c["final_score"] for c in candidates) / max(len(candidates), 1), 3
            ),
        },
    }


# ─── GET /recruiter/pipeline ──────────────────────────────────────────────────
@router.get("/pipeline")
async def get_pipeline(
    job_description_id: str = Query(...),
    current_user: UserModel = Depends(get_recruiter_or_admin),
    result_repo: ResultRepository = Depends(get_result_repo),
):
    """Get full hiring pipeline for a job description."""
    results = await result_repo.get_top_candidates(job_description_id, limit=100)
    pipeline = {
        "shortlisted": [],
        "interview_scheduled": [],
        "offer_made": [],
        "rejected": [],
        "pending_review": [],
    }
    for r in results:
        entry = {
            "resume_id": r.resume_id,
            "score": r.final_score,
            "recommendation": r.recommendation,
        }
        pipeline["pending_review"].append(entry)

    return {"job_description_id": job_description_id, "pipeline": pipeline, "total": len(results)}


# ─── GET /recruiter/stats ─────────────────────────────────────────────────────
@router.get("/stats")
async def get_recruiter_stats(
    current_user: UserModel = Depends(get_recruiter_or_admin),
    result_repo: ResultRepository = Depends(get_result_repo),
):
    """Aggregated recruiter dashboard statistics."""
    stats = await result_repo.get_analytics_summary()
    return {
        "total_ats_checks": stats.get("total_checks", 0),
        "average_score": round(stats.get("avg_score", 0), 3),
        "score_distribution": {
            "strong_matches": stats.get("strong_matches", 0),
            "good_matches": stats.get("good_matches", 0),
            "poor_matches": stats.get("poor_matches", 0),
        },
        "top_score": round(stats.get("max_score", 0), 3),
    }
