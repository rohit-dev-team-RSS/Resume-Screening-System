"""
AI Career Co-Pilot & Smart ATS + Interview Platform
Entry Point — FastAPI Application Bootstrap
"""
import time
from contextlib import asynccontextmanager
import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response
import asyncio
# ── Existing routes ────────────────────────────────────────────────────────────
from api.routes import (
    auth, resume, ats, skills, explain, enhance,
    interview, pdf_gen, recruiter, recruiter_v2, analytics, health,
)
from api.routes.recruiter_v2 import router as recruiter_v2_router
from api.routes.fake_detect import router as fake_detect_router
from api.routes import github

# ── New AI Interview routes ────────────────────────────────────────────────────
from api.routes.interview_ai import router as interview_ai_router
from api.routes.interview_analytics import router as interview_analytics_router
# from api.routes.live_interview import router as live_interview_router
from api.routes.live_interview import router as live_interview_router
from api.routes.recruiter_v2 import router as recruiter_router

from backend.services.ats_service import _get_bert_model
from config.db import connect_db, disconnect_db
from core.config import settings
from core.logging import setup_logging

setup_logging()
logger = structlog.get_logger(__name__)

REQUEST_COUNT  = Counter("http_requests_total", "Total requests", ["method", "endpoint", "status"])
REQUEST_LATENCY = Histogram("http_request_duration_seconds", "Latency", ["method", "endpoint"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting AI Career Platform", version=settings.APP_VERSION)
    await connect_db()
    logger.info("MongoDB connected")
    yield
    await disconnect_db()
    logger.info("Shutdown complete")


def create_application() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        # allow_origins=[
        #     "http://localhost:5173",
        #     "http://127.0.0.1:5173",
        #     "https://resume-screening-system-lyart.vercel.app",
        # ],
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next):
        t = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - t
        REQUEST_COUNT.labels(request.method, request.url.path, response.status_code).inc()
        REQUEST_LATENCY.labels(request.method, request.url.path).observe(duration)
        response.headers["X-Process-Time"] = f"{duration:.4f}s"
        return response

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled exception", path=request.url.path, error=str(exc))
        return JSONResponse(status_code=500,
            content={"success": False, "error": "Internal server error",
                     "detail": str(exc) if settings.DEBUG else "Contact support"})

    p = settings.API_V1_PREFIX

    # ── Health (no prefix) ────────────────────────────────────────────────────
    app.include_router(health.router, tags=["Health"])
    # ── Auth & Core ───────────────────────────────────────────────────────────
    app.include_router(auth.router,         prefix=f"{p}/auth",        tags=["Auth"])
    app.include_router(resume.router,       prefix=f"{p}/resume",      tags=["Resume"])
    app.include_router(ats.router,          prefix=f"{p}/ats",         tags=["ATS"])
    app.include_router(skills.router,       prefix=f"{p}/skills",      tags=["Skills"])
    app.include_router(explain.router,      prefix=f"{p}/explain",     tags=["Explain"])
    app.include_router(enhance.router,      prefix=f"{p}/enhance",     tags=["Enhance"])
    app.include_router(pdf_gen.router,      prefix=f"{p}/pdf",         tags=["PDF"])
    app.include_router(recruiter.router,    prefix=f"{p}/recruiter",   tags=["Recruiter"])
    app.include_router(recruiter_v2_router, prefix=f"{p}/recruiter/v2", tags=["Recruiter V2"])
    app.include_router(analytics.router,    prefix=f"{p}/analytics",   tags=["Analytics"])
    app.include_router(fake_detect_router,  prefix=f"{p}/fake-detect", tags=["Fake Detect"])
    app.include_router(github.router,       prefix=f"{p}/github",      tags=["GitHub"])
    app.include_router(interview.router, prefix=f"{p}/interview", tags=["Interview"])
    app.include_router(interview_ai_router, prefix=f"{p}/interview", tags=["AI Interview"])
    app.include_router(live_interview_router, prefix=f"{p}/live-interview", tags=["Live Interview"])
    app.include_router(interview_analytics_router, prefix=f"{p}/interview-analytics", tags=["Interview Analytics"])
    # app.include_router(recruiter_router, prefix="/api/v1/recruiter", tags=["Recruiter"])

    # ── Prometheus ────────────────────────────────────────────────────────────
    @app.get("/metrics", include_in_schema=False)
    async def metrics():
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    return app


app = create_application()

@app.on_event("startup")
async def preload_model():
    from services.ats_service import _get_bert_model

    def load():
        try:
            print("🔄 Loading BERT model in background...")
            _get_bert_model()
            print("✅ Model loaded successfully")
        except Exception as e:
            print("❌ Model load failed:", str(e))

    asyncio.create_task(asyncio.to_thread(load))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000,
                reload=settings.DEBUG, workers=1 if settings.DEBUG else 4)
