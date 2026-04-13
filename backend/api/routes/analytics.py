"""
Analytics Dashboard Routes — Platform-wide and user-level metrics
"""

from datetime import datetime, timedelta, timezone

import structlog
from fastapi import APIRouter, Depends, Query

from api.deps import get_current_user, get_admin_user, get_result_repo, get_user_repo
from config.db import get_database
from models.user_model import UserModel
from repositories.result_repo import ResultRepository
from repositories.user_repo import UserRepository

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get("/me")
async def get_my_analytics(
    days: int = Query(default=30, ge=1, le=365),
    current_user: UserModel = Depends(get_current_user),
    result_repo: ResultRepository = Depends(get_result_repo),
):
    summary = await result_repo.get_analytics_summary(str(current_user.id))
    recent_results, _ = await result_repo.get_results_by_user(str(current_user.id), skip=0, limit=10)
    score_trend = [{"date": r.created_at.strftime("%Y-%m-%d"), "score": r.final_score, "recommendation": r.recommendation} for r in recent_results]
    skill_frequency: dict = {}
    for r in recent_results:
        for skill in r.missing_skills:
            skill_frequency[skill] = skill_frequency.get(skill, 0) + 1
    top_missing = sorted(skill_frequency.items(), key=lambda x: x[1], reverse=True)[:10]
    return {
        "user_id": str(current_user.id),
        "period_days": days,
        "summary": {
            "total_ats_checks": summary.get("total_checks", 0),
            "average_score": round(summary.get("avg_score", 0), 3),
            "best_score": round(summary.get("max_score", 0), 3),
            "strong_matches": summary.get("strong_matches", 0),
            "good_matches": summary.get("good_matches", 0),
            "poor_matches": summary.get("poor_matches", 0),
        },
        "score_trend": score_trend,
        "top_missing_skills": [{"skill": k, "frequency": v} for k, v in top_missing],
        "profile_completeness": _compute_profile_completeness(current_user),
        "improvement_tips": _get_improvement_tips(summary),
    }


@router.get("/platform")
async def get_platform_analytics(
    admin_user: UserModel = Depends(get_admin_user),
    result_repo: ResultRepository = Depends(get_result_repo),
    user_repo: UserRepository = Depends(get_user_repo),
    db=Depends(get_database),
):
    global_summary = await result_repo.get_analytics_summary()
    user_stats = await user_repo.get_platform_user_stats()
    pipeline = [
        {"$group": {
            "_id": {"$switch": {
                "branches": [
                    {"case": {"$gte": ["$final_score", 0.8]}, "then": "80-100"},
                    {"case": {"$gte": ["$final_score", 0.6]}, "then": "60-79"},
                    {"case": {"$gte": ["$final_score", 0.4]}, "then": "40-59"},
                ],
                "default": "0-39"
            }},
            "count": {"$sum": 1},
        }},
    ]
    cursor = db.results.aggregate(pipeline)
    score_dist = {doc["_id"]: doc["count"] async for doc in cursor}
    pipeline2 = [
        {"$unwind": "$missing_skills"},
        {"$group": {"_id": "$missing_skills", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 15},
    ]
    cursor2 = db.results.aggregate(pipeline2)
    top_missing = [{"skill": doc["_id"], "count": doc["count"]} async for doc in cursor2]
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_checks = await db.results.count_documents({"created_at": {"$gte": week_ago}})
    new_users = await db.users.count_documents({"created_at": {"$gte": week_ago}})
    return {
        "global_summary": {
            "total_ats_checks": global_summary.get("total_checks", 0),
            "average_platform_score": round(global_summary.get("avg_score", 0), 3),
            "strong_match_rate": round(global_summary.get("strong_matches", 0) / max(global_summary.get("total_checks", 1), 1), 3),
        },
        "user_stats": user_stats,
        "score_distribution": score_dist,
        "top_missing_skills_platform": top_missing,
        "weekly_activity": {"ats_checks_last_7_days": recent_checks, "new_users_last_7_days": new_users},
    }


@router.get("/skills-market")
async def skills_market_analytics(
    current_user: UserModel = Depends(get_current_user),
    db=Depends(get_database),
):
    pipeline = [
        {"$unwind": "$missing_skills"},
        {"$group": {"_id": "$missing_skills", "demand_count": {"$sum": 1}}},
        {"$sort": {"demand_count": -1}},
        {"$limit": 20},
    ]
    cursor = db.results.aggregate(pipeline)
    skills_data = [doc async for doc in cursor]
    from services.skill_service import MARKET_DEMAND
    enriched = [{"skill": item["_id"], "demand_count": item["demand_count"], "market_demand_score": MARKET_DEMAND.get(item["_id"], 0.5)} for item in skills_data]
    enriched.sort(key=lambda x: x["market_demand_score"], reverse=True)
    return {"skills_in_demand": enriched, "analysis_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")}


def _compute_profile_completeness(user: UserModel) -> dict:
    fields = {
        "email": bool(user.email), "full_name": bool(user.full_name),
        "phone": bool(user.phone), "linkedin_url": bool(user.linkedin_url),
        "github_username": bool(user.github_username), "profile_picture": bool(user.profile_picture),
        "has_resume": user.total_resumes > 0, "has_ats_check": user.total_ats_checks > 0,
    }
    completed = sum(fields.values())
    score = round(completed / len(fields), 2)
    return {"score": score, "percentage": int(score * 100), "fields": fields}


def _get_improvement_tips(summary: dict) -> list:
    tips = []
    avg = summary.get("avg_score", 0)
    if avg < 0.5:
        tips.append("Your average ATS score is below 50%. Focus on keyword optimization.")
        tips.append("Tailor your resume for each job application.")
    elif avg < 0.7:
        tips.append("You're on track! Improve keyword matching for higher scores.")
    else:
        tips.append("Excellent scores! Target senior-level roles.")
    if summary.get("total_checks", 0) < 3:
        tips.append("Run more ATS checks to understand patterns.")
    tips.append("Update your resume every 3 months with new skills and achievements.")
    return tips
