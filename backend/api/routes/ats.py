"""
ATS Routes — Single match, bulk match, history
"""

import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from api.deps import (
    get_current_user, get_resume_repo, get_result_repo,
    get_ats_service, get_user_repo, PaginationParams
)
from models.result_model import ATSResultModel, JobDescriptionModel
from models.resume_model import ResumeStatus
from models.user_model import UserModel
from repositories.resume_repo import ResumeRepository
from repositories.result_repo import ResultRepository
from repositories.user_repo import UserRepository
from schemas.ats_schema import (
    ATSMatchRequest, ATSMatchResponse, BulkATSMatchRequest,
    BulkATSMatchResponse, BulkATSResultItem, ScoreBreakdown,
    KeywordAnalysis, SkillGapResponse, ExplainSectionResponse
)
from  services.ats_service import ATSService
from  utils.validators import validate_object_id

logger = structlog.get_logger(__name__)
router = APIRouter()


# ─── POST /ats/match ──────────────────────────────────────────────────────────
@router.post("/match", response_model=ATSMatchResponse)
async def match_resume(
    payload: ATSMatchRequest,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    result_repo: ResultRepository = Depends(get_result_repo),
    user_repo: UserRepository = Depends(get_user_repo),
    ats: ATSService = Depends(get_ats_service),
):
    """Score a resume against a job description using hybrid BERT + TF-IDF ATS engine."""
    validate_object_id(payload.resume_id, "resume_id")

    resume = await resume_repo.get_by_id_and_user(payload.resume_id, str(current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")
    if resume.status != ResumeStatus.PARSED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Resume is not yet parsed (status: {resume.status}). Wait for parsing to complete.",
        )

    # Save job description
    jd_data = {
        "user_id": str(current_user.id),
        "title": payload.job_title,
        "company": payload.company,
        "description": payload.job_description,
        "required_skills": payload.required_skills,
        "preferred_skills": payload.preferred_skills,
        "raw_text": payload.job_description,
    }
    jd = await result_repo.create_job_description(jd_data)

    # Run ATS scoring
    score_data = await ats.score_resume(
        resume=resume,
        job_description=payload.job_description,
        job_title=payload.job_title,
        required_skills=payload.required_skills,
        preferred_skills=payload.preferred_skills,
    )

    # Save result
    result = None
    if payload.save_result:
        result_record = {
            "user_id": str(current_user.id),
            "resume_id": payload.resume_id,
            "job_description_id": str(jd.id),
            **score_data,
        }
        result = await result_repo.create_result(result_record)
        await user_repo.increment_counter(str(current_user.id), "total_ats_checks")

    result_id = str(result.id) if result else "unsaved"
    return _build_ats_response(result_id, payload.resume_id, payload.job_title, score_data)


# ─── POST /ats/bulk-match ─────────────────────────────────────────────────────
@router.post("/bulk-match", response_model=BulkATSMatchResponse)
async def bulk_match(
    payload: BulkATSMatchRequest,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
    result_repo: ResultRepository = Depends(get_result_repo),
    ats: ATSService = Depends(get_ats_service),
):
    """Batch-score multiple resumes against one job description. (Recruiter feature)"""
    import time
    t_start = time.perf_counter()

    resumes = await resume_repo.get_multiple_by_ids(payload.resume_ids)
    parsed_resumes = [r for r in resumes if r.status == ResumeStatus.PARSED and r.parsed_data]
    if not parsed_resumes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No parsed resumes found in the provided IDs.",
        )

    # Bulk BERT embeddings (efficient)
    texts = [r.parsed_data.raw_text for r in parsed_resumes]
    bert_scores = ats.bulk_bert_similarity(texts, payload.job_description)

    results = []
    for i, (resume, bert_score) in enumerate(zip(parsed_resumes, bert_scores)):
        from  utils.nlp_utils import get_tfidf_similarity
        tfidf_score = get_tfidf_similarity(resume.parsed_data.raw_text, payload.job_description)
        final_score = round(0.6 * bert_score + 0.4 * tfidf_score, 4)

        from  utils.validators import score_to_label
        results.append(BulkATSResultItem(
            resume_id=str(resume.id),
            candidate_name=resume.parsed_data.full_name,
            final_score=final_score,
            recommendation=score_to_label(final_score),
            matched_keywords=len([
                kw for kw, _ in __import__("utils.nlp_utils", fromlist=["extract_keywords"]).extract_keywords(payload.job_description, top_n=30)
                if kw in (resume.parsed_data.raw_text or "").lower()
            ]),
            missing_skills_count=len(payload.required_skills) - sum(
                1 for s in payload.required_skills
                if s.lower() in (resume.parsed_data.raw_text or "").lower()
            ),
            rank=0,
        ))

    # Rank by score
    results.sort(key=lambda r: r.final_score, reverse=True)
    for idx, r in enumerate(results):
        r.rank = idx + 1

    return BulkATSMatchResponse(
        total_processed=len(results),
        results=results,
        processing_time_ms=int((time.perf_counter() - t_start) * 1000),
    )


# ─── GET /ats/history ─────────────────────────────────────────────────────────
@router.get("/history")
async def get_ats_history(
    pagination: PaginationParams = Depends(),
    min_score: float = None,
    current_user: UserModel = Depends(get_current_user),
    result_repo: ResultRepository = Depends(get_result_repo),
):
    """Get ATS check history for the current user."""
    results, total = await result_repo.get_results_by_user(
        str(current_user.id),
        skip=pagination.skip,
        limit=pagination.page_size,
        min_score=min_score,
    )
    return {
        "items": [_result_summary(r) for r in results],
        **pagination.to_response_meta(total),
    }


# ─── GET /ats/result/{result_id} ─────────────────────────────────────────────
@router.get("/result/{result_id}")
async def get_ats_result(
    result_id: str,
    current_user: UserModel = Depends(get_current_user),
    result_repo: ResultRepository = Depends(get_result_repo),
):
    """Get full ATS result by ID."""
    validate_object_id(result_id, "result_id")
    result = await result_repo.get_result_by_id(result_id)
    if not result or result.user_id != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result not found.")
    return result.model_dump()


# ─── Helpers ──────────────────────────────────────────────────────────────────
def _build_ats_response(result_id, resume_id, job_title, data) -> ATSMatchResponse:
    return ATSMatchResponse(
        result_id=result_id,
        resume_id=resume_id,
        job_title=job_title,
        scores=ScoreBreakdown(
            bert_score=data["bert_score"],
            tfidf_score=data["tfidf_score"],
            final_score=data["final_score"],
            keyword_score=data["keyword_score"],
            experience_score=data["experience_score"],
            education_score=data["education_score"],
            skills_score=data["skills_score"],
        ),
        keyword_analysis=KeywordAnalysis(
            matched_keywords=data["matched_keywords"],
            missing_keywords=data["missing_keywords"],
            keyword_match_rate=data["keyword_match_rate"],
            total_jd_keywords=len(data["matched_keywords"]) + len(data["missing_keywords"]),
            total_matched=len(data["matched_keywords"]),
        ),
        matched_skills=data["matched_skills"],
        missing_skills=data["missing_skills"],
        skill_gaps=[SkillGapResponse(**sg) for sg in data["skill_gaps"]],
        explanation=[ExplainSectionResponse(**e) for e in data["explanation"]],
        overall_assessment=data["overall_assessment"],
        strengths=data["strengths"],
        weaknesses=data["weaknesses"],
        improvement_suggestions=data["improvement_suggestions"],
        recommendation=data["recommendation"],
        processing_time_ms=data["processing_time_ms"],
    )


def _result_summary(result: ATSResultModel) -> dict:
    return {
        "result_id": str(result.id),
        "resume_id": result.resume_id,
        "final_score": result.final_score,
        "recommendation": result.recommendation,
        "matched_keywords_count": len(result.matched_keywords),
        "missing_skills_count": len(result.missing_skills),
        "created_at": result.created_at,
    }
