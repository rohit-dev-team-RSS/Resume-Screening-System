"""
Application Configuration — Environment-driven settings via Pydantic v2
"""

from functools import lru_cache
from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ───────────────────────────────────────────────────────────────────
    APP_NAME: str = "AI Career Co-Pilot & Smart ATS Platform"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = Field(default="development", pattern="^(development|staging|production)$")
    ENV: str = "development"
    # ── MongoDB ───────────────────────────────────────────────────────────────
    MONGO_URI: str = "mongodb://localhost:27017"
    MONGO_DB_NAME: str = "ai_career_platform"
    MONGO_MAX_CONNECTIONS: int = 100
    MONGO_MIN_CONNECTIONS: int = 10

    # ── JWT ───────────────────────────────────────────────────────────────────
    SECRET_KEY: str = "super-secret-change-in-production-use-256bit-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://resume-screening-system-lyart.vercel.app",
    ]

    # ── File Upload ───────────────────────────────────────────────────────────
    MAX_FILE_SIZE_MB: int = 10
    ALLOWED_FILE_TYPES: List[str] = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
    UPLOAD_DIR: str = "./uploads"

    # ── FTP (Hostinger) ───────────────────────────────────────────────────────
    FTP_HOST: str
    FTP_USERNAME: str
    FTP_PASSWORD: str
    FTP_PORT: int = 21
    FTP_BASE_URL: str

    # ── NLP / ML ──────────────────────────────────────────────────────────────
    BERT_MODEL_NAME: str = "all-MiniLM-L6-v2"
    BERT_SCORE_WEIGHT: float = 0.6
    TFIDF_SCORE_WEIGHT: float = 0.4
    MAX_SEQUENCE_LENGTH: int = 512

    # ── GitHub ────────────────────────────────────────────────────────────────
    GITHUB_TOKEN: Optional[str] = None
    GITHUB_API_BASE: str = "https://api.github.com"

    # ── AI/LLM ────────────────────────────────────────────────────────────────
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    LLM_PROVIDER: str = Field(default="anthropic", pattern="^(openai|anthropic|local)$")
    LLM_MAX_TOKENS: int = 2048
    LLM_TEMPERATURE: float = 0.7

    # ── Redis / Celery ────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    # ── Sentry ────────────────────────────────────────────────────────────────
    SENTRY_DSN: Optional[str] = None

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    # ── Pagination ────────────────────────────────────────────────────────────
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    GROQ_API_KEY: str | None = None
    MISTRAL_API_KEY: str | None = None
    GAMIFICATION_ENABLED: bool = True
    LEADERBOARD_SIZE: int = 50
    GOOGLE_CLIENT_ID: str = "1032374161774-fu7okbh4l4cg1bt30t8o47p1ttto95dg.apps.googleusercontent.com"
    @field_validator("BERT_SCORE_WEIGHT", "TFIDF_SCORE_WEIGHT")
    @classmethod
    def weights_must_sum_to_one(cls, v, info):
        return v  # Checked at app startup

    @property
    def max_file_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()