"""
Pydantic v2 Schemas — ATS Matching, Skill Analysis
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


# ─── ATS Request ──────────────────────────────────────────────────────────────
class ATSMatchRequest(BaseModel):
    resume_id: str
    job_title: str = Field(min_length=2, max_length=200)
    job_description: str = Field(min_length=50, max_length=10000)
    company: Optional[str] = None
    required_skills: List[str] = []
    preferred_skills: List[str] = []
    experience_years_min: Optional[int] = Field(default=None, ge=0, le=50)
    experience_years_max: Optional[int] = Field(default=None, ge=0, le=50)
    save_result: bool = True

    @field_validator("required_skills", "preferred_skills", mode="before")
    @classmethod
    def clean_skills(cls, v):
        return [s.strip().lower() for s in v if s.strip()]


class BulkATSMatchRequest(BaseModel):
    resume_ids: List[str] = Field(min_length=1, max_length=50)
    job_title: str = Field(min_length=2, max_length=200)
    job_description: str = Field(min_length=50, max_length=10000)
    company: Optional[str] = None
    required_skills: List[str] = []


# ─── ATS Response ─────────────────────────────────────────────────────────────
class ScoreBreakdown(BaseModel):
    bert_score: float
    tfidf_score: float
    final_score: float
    keyword_score: float
    experience_score: float
    education_score: float
    skills_score: float


class KeywordAnalysis(BaseModel):
    matched_keywords: List[str]
    missing_keywords: List[str]
    keyword_match_rate: float
    total_jd_keywords: int
    total_matched: int


class SkillGapResponse(BaseModel):
    skill: str
    importance: str
    learning_resources: List[Dict[str, str]]
    estimated_learning_weeks: Optional[int]


class ExplainSectionResponse(BaseModel):
    section: str
    score: float
    reason: str
    suggestions: List[str]


class ATSMatchResponse(BaseModel):
    result_id: str
    resume_id: str
    job_title: str
    scores: ScoreBreakdown
    keyword_analysis: KeywordAnalysis
    matched_skills: List[str]
    missing_skills: List[str]
    skill_gaps: List[SkillGapResponse]
    explanation: List[ExplainSectionResponse]
    overall_assessment: str
    strengths: List[str]
    weaknesses: List[str]
    improvement_suggestions: List[str]
    recommendation: str
    processing_time_ms: int


class BulkATSResultItem(BaseModel):
    resume_id: str
    candidate_name: Optional[str]
    final_score: float
    recommendation: str
    matched_keywords: int
    missing_skills_count: int
    rank: int


class BulkATSMatchResponse(BaseModel):
    total_processed: int
    results: List[BulkATSResultItem]
    processing_time_ms: int


# ─── Skill Schema ─────────────────────────────────────────────────────────────
class SkillAnalysisRequest(BaseModel):
    resume_id: str
    target_role: Optional[str] = None
    industry: Optional[str] = None


class LearningResource(BaseModel):
    title: str
    url: str
    platform: str
    type: str  # course | book | tutorial | certification
    duration: Optional[str] = None
    cost: str = "free"


class SkillGapDetail(BaseModel):
    skill: str
    importance: str
    current_level: str  # none | beginner | intermediate | advanced
    target_level: str
    resources: List[LearningResource]
    estimated_weeks: int


class LearningPathStep(BaseModel):
    week: int
    skill: str
    action: str
    resources: List[str]
    milestone: Optional[str] = None


class SkillAnalysisResponse(BaseModel):
    resume_id: str
    current_skills: List[str]
    technical_skills: List[str]
    soft_skills: List[str]
    skill_gaps: List[SkillGapDetail]
    learning_path: List[LearningPathStep]
    estimated_upskilling_weeks: int
    market_demand_score: float
    top_missing_skills: List[str]
