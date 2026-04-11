"""
Pydantic v2 Schemas — Resume Upload & Response
"""

from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from models.resume_model import (
    ResumeStatus, ContactInfo, WorkExperience, Education,
    Project, Certification, ParsedResumeData
)


class ResumeUploadResponse(BaseModel):
    resume_id: str
    filename: str
    status: ResumeStatus
    message: str


class ResumeDetailResponse(BaseModel):
    id: str
    user_id: str
    filename: str
    original_filename: str
    file_type: str
    file_size_bytes: int
    status: ResumeStatus
    parsed_data: Optional[ParsedResumeData]
    tags: List[str]
    is_primary: bool
    version: int
    created_at: datetime
    updated_at: datetime


class ResumeListResponse(BaseModel):
    resumes: List[ResumeDetailResponse]
    total: int


class ResumeUpdateRequest(BaseModel):
    tags: Optional[List[str]] = None
    is_primary: Optional[bool] = None


class EnhanceResumeRequest(BaseModel):
    resume_id: str
    job_description: Optional[str] = None
    target_role: Optional[str] = None
    enhancement_areas: List[str] = Field(
        default=["summary", "experience", "skills", "keywords"],
        description="Areas to enhance: summary | experience | skills | keywords | formatting"
    )
    tone: str = Field(default="professional", pattern="^(professional|creative|academic)$")


class EnhanceResumeResponse(BaseModel):
    resume_id: str
    original_summary: Optional[str]
    enhanced_summary: Optional[str]
    original_experience: List[Dict]
    enhanced_experience: List[Dict]
    added_keywords: List[str]
    formatting_suggestions: List[str]
    ats_improvement_estimate: float
    enhancement_notes: List[str]


class InterviewRequest(BaseModel):
    resume_id: str
    job_description: Optional[str] = None
    job_title: Optional[str] = None
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    interview_type: str = Field(
        default="mixed",
        pattern="^(technical|behavioral|situational|mixed)$"
    )
    num_questions: int = Field(default=10, ge=3, le=30)


class InterviewQuestion(BaseModel):
    question_number: int
    type: str
    question: str
    category: str
    difficulty: str
    what_to_look_for: str
    sample_answer_framework: Optional[str] = None
    follow_up_questions: List[str] = []


class InterviewResponse(BaseModel):
    interview_id: str
    resume_id: str
    job_title: Optional[str]
    questions: List[InterviewQuestion]
    preparation_tips: List[str]
    estimated_duration_minutes: int
    created_at: datetime
