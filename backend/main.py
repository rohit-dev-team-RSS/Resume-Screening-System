"""
AI Career Co-Pilot & Smart ATS Platform
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

from api.routes import auth, resume, ats, skills, explain, enhance, interview
from api.routes import github, fake_detect, pdf_gen, recruiter, analytics, health
from config.db import connect_db, disconnect_db
from core.config import settings
from core.logging import setup_logging

# ─── Logging ──────────────────────────────────────────────────────────────────
setup_logging()
logger = structlog.get_logger(__name__)

# ─── Prometheus Metrics ───────────────────────────────────────────────────────
REQUEST_COUNT = Counter(
    "http_requests_total", "Total HTTP requests", ["method", "endpoint", "status"]
)
REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds", "HTTP request latency", ["method", "endpoint"]
)


# ─── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting AI Career Co-Pilot Platform", version=settings.APP_VERSION)
    await connect_db()
    logger.info("✅ MongoDB connected")
    yield
    await disconnect_db()
    logger.info("🔴 MongoDB disconnected — shutdown complete")


# ─── App Factory ──────────────────────────────────────────────────────────────
def create_application() -> FastAPI:
    application = FastAPI(
        title=settings.APP_NAME,
        description="""
## 🚀 AI Career Co-Pilot & Smart ATS Platform

Enterprise-grade AI backend for intelligent resume analysis, ATS scoring,
career coaching, and recruiter tools.

### Features
- **Resume Parsing** — PDF/DOCX extraction with NLP
- **ATS Scoring** — Hybrid TF-IDF + BERT similarity
- **Skill Intelligence** — Gap analysis & learning paths
- **Explainable AI** — Transparent scoring breakdowns
- **Resume Enhancer** — LLM-powered improvements
- **Mock Interviews** — AI-generated Q&A sessions
- **GitHub Analysis** — Tech stack & contribution insights
- **Fake Detection** — Experience authenticity checks
- **Recruiter Dashboard** — Bulk ranking & filtering
- **Analytics** — Platform-wide usage metrics
        """,
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # ── Middleware ─────────────────────────────────────────────────────────────
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.add_middleware(GZipMiddleware, minimum_size=1000)

    # ── Request Timing Middleware ──────────────────────────────────────────────
    @application.middleware("http")
    async def metrics_middleware(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration = time.perf_counter() - start
        endpoint = request.url.path
        REQUEST_COUNT.labels(request.method, endpoint, response.status_code).inc()
        REQUEST_LATENCY.labels(request.method, endpoint).observe(duration)
        response.headers["X-Process-Time"] = f"{duration:.4f}s"
        return response

    # ── Global Exception Handler ───────────────────────────────────────────────
    @application.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error("Unhandled exception", path=request.url.path, error=str(exc))
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": "Internal server error",
                "detail": str(exc) if settings.DEBUG else "Contact support",
            },
        )

    # ── Routers ───────────────────────────────────────────────────────────────
    prefix = settings.API_V1_PREFIX
    application.include_router(health.router, tags=["Health"])
    application.include_router(auth.router, prefix=f"{prefix}/auth", tags=["Authentication"])
    application.include_router(resume.router, prefix=f"{prefix}/resume", tags=["Resume"])
    application.include_router(ats.router, prefix=f"{prefix}/ats", tags=["ATS Engine"])
    application.include_router(skills.router, prefix=f"{prefix}/skills", tags=["Skills"])
    application.include_router(explain.router, prefix=f"{prefix}/explain", tags=["Explainable AI"])
    application.include_router(enhance.router, prefix=f"{prefix}/enhance", tags=["AI Enhancer"])
    application.include_router(interview.router, prefix=f"{prefix}/interview", tags=["Mock Interview"])
    application.include_router(github.router, prefix=f"{prefix}/github", tags=["GitHub Analysis"])
    application.include_router(fake_detect.router, prefix=f"{prefix}/fake-detect", tags=["Fake Detection"])
    application.include_router(pdf_gen.router, prefix=f"{prefix}/pdf", tags=["PDF Generator"])
    application.include_router(recruiter.router, prefix=f"{prefix}/recruiter", tags=["Recruiter"])
    application.include_router(analytics.router, prefix=f"{prefix}/analytics", tags=["Analytics"])

    # ── Prometheus Metrics Endpoint ────────────────────────────────────────────
    @application.get("/metrics", include_in_schema=False)
    async def metrics():
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    return application


app = create_application()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        workers=1 if settings.DEBUG else 4,
        log_level="info",
    )
