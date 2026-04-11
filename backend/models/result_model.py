"""
MongoDB Document Models — ATS Result, Job Description
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SeniorityLevel(str, Enum):
    INTERN = "intern"
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"
    LEAD = "lead"
    PRINCIPAL = "principal"
    EXECUTIVE = "executive"


class JobDescriptionModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    title: str
    company: Optional[str] = None
    description: str
    required_skills: List[str] = []
    preferred_skills: List[str] = []
    experience_years_min: Optional[int] = None
    experience_years_max: Optional[int] = None
    seniority_level: Optional[SeniorityLevel] = None
    location: Optional[str] = None
    remote: bool = False
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    industry: Optional[str] = None
    raw_text: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        populate_by_name = True


class SkillGap(BaseModel):
    skill: str
    importance: str  # critical | important | nice_to_have
    learning_resources: List[Dict[str, str]] = []
    estimated_learning_weeks: Optional[int] = None


class ExplainSection(BaseModel):
    section: str
    score: float
    reason: str
    suggestions: List[str] = []


class ATSResultModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    resume_id: str
    job_description_id: str

    # ── Scores ────────────────────────────────────────────────────────────────
    bert_score: float = 0.0
    tfidf_score: float = 0.0
    final_score: float = 0.0
    keyword_score: float = 0.0
    experience_score: float = 0.0
    education_score: float = 0.0
    skills_score: float = 0.0

    # ── Keywords ──────────────────────────────────────────────────────────────
    matched_keywords: List[str] = []
    missing_keywords: List[str] = []
    keyword_match_rate: float = 0.0

    # ── Skill Analysis ────────────────────────────────────────────────────────
    matched_skills: List[str] = []
    missing_skills: List[str] = []
    skill_gaps: List[SkillGap] = []
    learning_path: List[Dict[str, Any]] = []

    # ── Explainable AI ────────────────────────────────────────────────────────
    explanation: List[ExplainSection] = []
    overall_assessment: str = ""
    improvement_suggestions: List[str] = []
    strengths: List[str] = []
    weaknesses: List[str] = []

    # ── Fake Detection ────────────────────────────────────────────────────────
    authenticity_score: Optional[float] = None
    red_flags: List[str] = []

    # ── Recommendations ───────────────────────────────────────────────────────
    recommendation: str = ""  # strong_match | good_match | partial_match | poor_match
    rank_percentile: Optional[float] = None

    processing_time_ms: int = 0
    model_versions: Dict[str, str] = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        populate_by_name = True
