"""
Live Interview Routes
POST /live-interview/sessions              — create session
POST /live-interview/sessions/{id}/start   — start
POST /live-interview/sessions/{id}/answer  — submit answer + evaluate
POST /live-interview/sessions/{id}/cheat   — record cheating event
POST /live-interview/sessions/{id}/complete — finalize + generate report
GET  /live-interview/sessions/{id}         — fetch session
GET  /live-interview/history               — user history
"""
from typing import List, Optional
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field

from api.deps import get_current_user, get_database
from models.user_model import UserModel
from services.live_interview_service import LiveInterviewService
from services.evaluation_service import EvaluationService

logger = structlog.get_logger(__name__)
router = APIRouter()

_eval_svc = EvaluationService()


def get_svc(db=Depends(get_database)) -> LiveInterviewService:
    return LiveInterviewService(db)


# ── Request models ─────────────────────────────────────────────────────────────
class CreateSessionRequest(BaseModel):
    job_title:      str = "Software Engineer"
    difficulty:     str = Field(default="medium", pattern="^(easy|medium|hard|mixed)$")
    interview_type: str = Field(default="mixed",  pattern="^(technical|behavioral|situational|mixed)$")
    num_questions:  int = Field(default=8, ge=3, le=15)


class SubmitAnswerRequest(BaseModel):
    question_id:    int
    question_text:  str
    category:       str = "technical"
    answer:         str
    answer_source:  str = "text"            # text | voice
    time_taken_secs:int = 0
    reattempted:    bool = False
    voice_pauses:   int = 0
    speech_rate_wpm:float = 0.0


class CheatingEventRequest(BaseModel):
    event_type: str
    severity:   str = "medium"
    details:    Optional[str] = None


class CompleteSessionRequest(BaseModel):
    total_time_secs: int = 0


# ── Routes ────────────────────────────────────────────────────────────────────
@router.post("/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: CreateSessionRequest,
    user:    UserModel = Depends(get_current_user),
    svc:     LiveInterviewService = Depends(get_svc),
):
    data = await svc.create_session(
        user_id=str(user.id),
        job_title=payload.job_title,
        difficulty=payload.difficulty,
        interview_type=payload.interview_type,
        num_questions=payload.num_questions,
    )
    return {"success": True, **data}


@router.post("/sessions/{session_id}/start")
async def start_session(
    session_id: str,
    user:       UserModel = Depends(get_current_user),
    svc:        LiveInterviewService = Depends(get_svc),
):
    ok = await svc.start_session(session_id, str(user.id))
    if not ok:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True, "started_at": datetime.now(timezone.utc).isoformat()}


@router.post("/sessions/{session_id}/answer")
async def submit_answer(
    session_id: str,
    payload:    SubmitAnswerRequest,
    user:       UserModel = Depends(get_current_user),
    svc:        LiveInterviewService = Depends(get_svc),
):
    """Submit answer → evaluate with Groq → save → return feedback."""
    # Evaluate
    eval_result = await _eval_svc.evaluate_answer(
        question       = payload.question_text,
        answer         = payload.answer,
        category       = payload.category,
        difficulty     = "medium",
        job_title      = "Software Engineer",
        voice_pauses   = payload.voice_pauses,
        speech_rate    = payload.speech_rate_wpm,
    )

    answer_doc = {
        "question_id":       payload.question_id,
        "question_text":     payload.question_text,
        "category":          payload.category,
        "user_answer":       payload.answer,
        "answer_source":     payload.answer_source,
        "time_taken_secs":   payload.time_taken_secs,
        "reattempted":       payload.reattempted,
        "ai_score":          eval_result.get("overall_score", 0),
        "relevance_score":   eval_result.get("relevance_score", 0),
        "clarity_score":     eval_result.get("clarity_score", 0),
        "confidence_score":  eval_result.get("confidence_score", 0),
        "filler_word_count": eval_result.get("filler_word_count", 0),
        "ai_feedback":       eval_result.get("feedback", ""),
        "improvement_tips":  eval_result.get("improvement_tips", []),
        "keywords_found":    eval_result.get("keywords_found", []),
        "keywords_missing":  eval_result.get("keywords_missing", []),
        "grade":             eval_result.get("grade", "N/A"),
        "ideal_answer_summary": eval_result.get("ideal_answer_summary", ""),
        "evaluated_at":      datetime.now(timezone.utc).isoformat(),
    }

    await svc.save_answer(session_id, str(user.id), answer_doc)
    logger.info("Answer submitted", session_id=session_id, score=answer_doc["ai_score"])

    return {
        "success":     True,
        "question_id": payload.question_id,
        "evaluation":  eval_result,
    }


@router.post("/sessions/{session_id}/cheat")
async def record_cheating_event(
    session_id: str,
    payload:    CheatingEventRequest,
    user:       UserModel = Depends(get_current_user),
    svc:        LiveInterviewService = Depends(get_svc),
):
    event = {
        "event_type": payload.event_type,
        "severity":   payload.severity,
        "details":    payload.details,
        "timestamp":  datetime.now(timezone.utc).isoformat(),
    }
    result = await svc.record_cheating_event(session_id, str(user.id), event)
    return {"success": True, **result}


@router.post("/sessions/{session_id}/complete")
async def complete_session(
    session_id: str,
    payload:    CompleteSessionRequest,
    user:       UserModel = Depends(get_current_user),
    svc:        LiveInterviewService = Depends(get_svc),
):
    """Finalize session — compute aggregated stats + AI summary report."""
    session = await svc.get_session(session_id, str(user.id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    answers = session.get("answers", [])
    if not answers:
        raise HTTPException(status_code=400, detail="No answers submitted")

    # Aggregate scores
    scores = [a.get("ai_score", 0) for a in answers if a.get("ai_score") is not None]
    conf   = [a.get("confidence_score", 0) for a in answers]
    clar   = [a.get("clarity_score", 0) for a in answers]
    relev  = [a.get("relevance_score", 0) for a in answers]

    avg_score = sum(scores) / len(scores) if scores else 0
    avg_conf  = sum(conf) / len(conf)   if conf   else 0
    avg_clar  = sum(clar) / len(clar)   if clar   else 0
    avg_relev = sum(relev) / len(relev) if relev  else 0

    # Generate AI summary
    qa_pairs = [{"question": a["question_text"], "answer": a["user_answer"], "score": a.get("ai_score",0)} for a in answers]
    summary = await _eval_svc.generate_session_summary(
        job_title      = session.get("job_title",""),
        qa_pairs       = qa_pairs,
        overall_score  = avg_score,
        cheating_score = session.get("cheating_score", 0),
    )

    # Top-level strengths/weaknesses from individual answers
    all_strengths  = []
    all_weaknesses = []
    for a in answers:
        all_strengths.extend(a.get("improvement_tips", []))
    top_strengths  = summary.get("top_strengths", all_strengths[:3])
    top_weaknesses = summary.get("critical_gaps", all_weaknesses[:3])

    overall_data = {
        "overall_score":       round(avg_score, 1),
        "avg_confidence":      round(avg_conf, 1),
        "avg_clarity":         round(avg_clar, 1),
        "avg_relevance":       round(avg_relev, 1),
        "strengths":           top_strengths,
        "weaknesses":          top_weaknesses,
        "summary":             summary.get("executive_summary", ""),
        "session_summary":     summary,
        "total_time_secs":     payload.total_time_secs,
    }

    completed = await svc.complete_session(session_id, str(user.id), overall_data)
    return {"success": True, "session": completed, "summary": summary}


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str,
    user:       UserModel = Depends(get_current_user),
    svc:        LiveInterviewService = Depends(get_svc),
):
    session = await svc.get_session(session_id, str(user.id))
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.get("/history")
async def get_history(
    limit: int = Query(default=20, ge=1, le=100),
    user:  UserModel = Depends(get_current_user),
    svc:   LiveInterviewService = Depends(get_svc),
):
    history = await svc.get_user_history(str(user.id), limit=limit)
    return {"sessions": history, "total": len(history)}
