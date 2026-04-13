"""
AI Interview Routes — AI question generation, answer evaluation, WebSocket, cheating, gamification
Extends existing /interview routes WITHOUT breaking them
"""
import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field

from api.deps import get_current_user, get_resume_repo, get_database
from config.db import get_database
from models.resume_model import ResumeStatus
from models.user_model import UserModel
from repositories.resume_repo import ResumeRepository
from services.ai_interview_service import AIInterviewService
from services.cheating_service import CheatingDetectionService, CheatingEvent
from services.gamification_service import GamificationService

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/ai", tags=["AI Interview"])

# ─── Singletons ───────────────────────────────────────────────────────────────
_ai_interview_svc = AIInterviewService()
_cheating_svc = CheatingDetectionService()


def get_gamification_service(db=Depends(get_database)) -> GamificationService:
    return GamificationService(db)


# ─── Request/Response Models ──────────────────────────────────────────────────
class AIInterviewRequest(BaseModel):
    resume_id: str
    job_title: str = "Software Engineer"
    job_description: Optional[str] = None
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    interview_type: str = Field(default="mixed", pattern="^(technical|behavioral|situational|mixed)$")
    num_questions: int = Field(default=10, ge=3, le=25)


class AnswerFeedbackRequest(BaseModel):
    question: str
    user_answer: str
    ideal_answer: Optional[str] = ""
    question_type: str = "technical"
    difficulty: str = "medium"
    time_taken_seconds: Optional[int] = None


class CheatingReportRequest(BaseModel):
    session_id: str
    events: List[dict] = []


class InterviewCompleteRequest(BaseModel):
    session_id: str
    interview_score: float = Field(ge=0.0, le=1.0)
    questions_answered: int
    clean_session: bool = True


# ─── POST /interview/ai/generate ──────────────────────────────────────────────
@router.post("/generate")
async def generate_ai_interview(
    payload: AIInterviewRequest,
    current_user: UserModel = Depends(get_current_user),
    resume_repo: ResumeRepository = Depends(get_resume_repo),
):
    """Generate LLM-powered interview questions with ideal answers."""
    resume = await resume_repo.get_by_id_and_user(payload.resume_id, str(current_user.id))
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found.")
    if resume.status != ResumeStatus.PARSED:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Resume must be parsed before generating an interview.",
        )

    result = await _ai_interview_svc.generate_ai_questions(
        resume=resume,
        job_title=payload.job_title,
        job_description=payload.job_description,
        difficulty=payload.difficulty,
        interview_type=payload.interview_type,
        num_questions=payload.num_questions,
    )
    session_id = str(uuid.uuid4())
    return {
        "session_id": session_id,
        "resume_id": payload.resume_id,
        **result,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


# ─── POST /interview/feedback ──────────────────────────────────────────────────
@router.post("/feedback")
async def evaluate_answer(
    payload: AnswerFeedbackRequest,
    current_user: UserModel = Depends(get_current_user),
):
    """Evaluate a candidate's answer using LLM and return detailed feedback."""
    if len(payload.user_answer.strip()) < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Answer is too short to evaluate meaningfully.",
        )

    feedback = await _ai_interview_svc.evaluate_answer(
        question=payload.question,
        user_answer=payload.user_answer,
        ideal_answer=payload.ideal_answer or "",
        question_type=payload.question_type,
        difficulty=payload.difficulty,
    )

    # Speed bonus check
    if payload.time_taken_seconds and payload.time_taken_seconds <= 30 and feedback["score"] >= 8:
        feedback["speed_bonus"] = True
        feedback["bonus_points"] = 15
    else:
        feedback["speed_bonus"] = False
        feedback["bonus_points"] = 0

    return feedback


# ─── POST /interview/cheating/report ─────────────────────────────────────────
@router.post("/cheating/report")
async def submit_cheating_report(
    payload: CheatingReportRequest,
    current_user: UserModel = Depends(get_current_user),
    db=Depends(get_database),
):
    """Submit cheating events and receive a risk assessment."""
    report = _cheating_svc.analyze_session(payload.session_id, payload.events)

    # Persist report
    await db.cheating_reports.insert_one({
        "user_id": str(current_user.id),
        "session_id": payload.session_id,
        "report": report.model_dump(),
        "created_at": datetime.now(timezone.utc),
    })

    return report.model_dump()


# ─── POST /interview/complete ─────────────────────────────────────────────────
@router.post("/complete")
async def complete_interview_session(
    payload: InterviewCompleteRequest,
    current_user: UserModel = Depends(get_current_user),
    gamification: GamificationService = Depends(get_gamification_service),
):
    """Mark interview as complete and award gamification rewards."""
    result = await gamification.process_interview_result(
        user_id=str(current_user.id),
        interview_score=payload.interview_score,
        questions_answered=payload.questions_answered,
        clean_session=payload.clean_session,
    )
    return {
        "session_id": payload.session_id,
        "status": "completed",
        "gamification": result,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }


# ─── GET /interview/gamification/profile ─────────────────────────────────────
@router.get("/gamification/profile")
async def get_gamification_profile(
    current_user: UserModel = Depends(get_current_user),
    gamification: GamificationService = Depends(get_gamification_service),
):
    """Get user's points, badges, streak, and level."""
    return await gamification.get_profile(str(current_user.id))


# ─── GET /interview/gamification/leaderboard ─────────────────────────────────
@router.get("/gamification/leaderboard")
async def get_leaderboard(
    limit: int = 20,
    current_user: UserModel = Depends(get_current_user),
    gamification: GamificationService = Depends(get_gamification_service),
):
    """Global leaderboard — top performers by total points."""
    board = await gamification.get_leaderboard(limit=min(limit, 50))

    # Find current user's rank
    my_profile = await gamification.get_profile(str(current_user.id))
    my_rank = next((e["rank"] for e in board if e["user_id"] == str(current_user.id)), None)

    return {
        "leaderboard": board,
        "my_rank": my_rank,
        "my_profile": my_profile,
        "total_participants": len(board),
    }


# ─── GET /interview/badges/catalog ───────────────────────────────────────────
@router.get("/badges/catalog")
async def get_badge_catalog(current_user: UserModel = Depends(get_current_user)):
    """List all available badges with requirements."""
    from services.gamification_service import BADGES
    return {"badges": [{"id": k, **v} for k, v in BADGES.items()]}


# ─── WebSocket /interview/ws/{session_id} ─────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active: dict[str, WebSocket] = {}

    async def connect(self, session_id: str, ws: WebSocket):
        await ws.accept()
        self.active[session_id] = ws
        logger.info("WS connected", session_id=session_id)

    def disconnect(self, session_id: str):
        self.active.pop(session_id, None)
        logger.info("WS disconnected", session_id=session_id)

    async def send(self, session_id: str, data: dict):
        ws = self.active.get(session_id)
        if ws:
            try:
                await ws.send_json(data)
            except Exception as e:
                logger.warning("WS send failed", session_id=session_id, error=str(e))


manager = ConnectionManager()


@router.websocket("/ws/{session_id}")
async def interview_websocket(session_id: str, ws: WebSocket):
    """
    WebSocket for real-time interview session:
    - Client sends: { type: "answer", question_id, answer, time_taken }
    - Server sends: { type: "feedback", score, ... } | { type: "next_question", question } | { type: "session_end", summary }
    """
    await manager.connect(session_id, ws)
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            msg_type = msg.get("type")

            if msg_type == "ping":
                await ws.send_json({"type": "pong", "session_id": session_id, "ts": datetime.now(timezone.utc).isoformat()})

            elif msg_type == "answer":
                # Evaluate answer in real-time
                feedback = await _ai_interview_svc.evaluate_answer(
                    question=msg.get("question", ""),
                    user_answer=msg.get("answer", ""),
                    ideal_answer=msg.get("ideal_answer", ""),
                    question_type=msg.get("question_type", "technical"),
                    difficulty=msg.get("difficulty", "medium"),
                )
                await ws.send_json({
                    "type": "feedback",
                    "question_id": msg.get("question_id"),
                    "feedback": feedback,
                    "ts": datetime.now(timezone.utc).isoformat(),
                })

            elif msg_type == "cheating_event":
                # Log cheating event in real-time
                await ws.send_json({
                    "type": "cheating_acknowledged",
                    "event_type": msg.get("event_type"),
                    "severity": msg.get("severity", "medium"),
                    "ts": datetime.now(timezone.utc).isoformat(),
                })

            elif msg_type == "session_end":
                events = msg.get("cheating_events", [])
                report = _cheating_svc.analyze_session(session_id, events)
                await ws.send_json({
                    "type": "session_complete",
                    "cheating_report": report.model_dump(),
                    "ts": datetime.now(timezone.utc).isoformat(),
                })

    except WebSocketDisconnect:
        manager.disconnect(session_id)
    except Exception as e:
        logger.error("WebSocket error", session_id=session_id, error=str(e))
        manager.disconnect(session_id)
