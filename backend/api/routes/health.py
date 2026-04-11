"""Health Check Routes"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from config.db import get_database
from core.config import settings

router = APIRouter()

@router.get("/health", tags=["Health"])
async def health_check(db=Depends(get_database)):
    db_status = "ok"
    try:
        await db.command("ping")
    except Exception:
        db_status = "degraded"
    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": {"mongodb": db_status, "api": "ok"},
    }

@router.get("/", tags=["Health"])
async def root():
    return {"name": settings.APP_NAME, "version": settings.APP_VERSION, "docs": "/docs", "health": "/health", "status": "running"}
