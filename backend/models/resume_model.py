"""
MongoDB Document Models — Resume
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class ResumeStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PARSED = "parsed"
    FAILED = "failed"


class ContactInfo(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None


class WorkExperience(BaseModel):
    company: str
    title: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    duration_months: Optional[int] = None
    description: Optional[str] = None
    technologies: List[str] = []
    is_current: bool = False


class Education(BaseModel):
    institution: str
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_year: Optional[int] = None
    end_year: Optional[int] = None
    gpa: Optional[float] = None


class Project(BaseModel):
    name: str
    description: Optional[str] = None
    technologies: List[str] = []
    url: Optional[str] = None
    github_url: Optional[str] = None


class Certification(BaseModel):
    name: str
    issuer: Optional[str] = None
    issue_date: Optional[str] = None
    expiry_date: Optional[str] = None
    credential_id: Optional[str] = None


class ParsedResumeData(BaseModel):
    raw_text: str = ""
    contact_info: ContactInfo = Field(default_factory=ContactInfo)
    full_name: Optional[str] = None
    summary: Optional[str] = None
    skills: List[str] = []
    technical_skills: List[str] = []
    soft_skills: List[str] = []
    work_experience: List[WorkExperience] = []
    education: List[Education] = []
    projects: List[Project] = []
    certifications: List[Certification] = []
    languages: List[str] = []
    total_experience_years: float = 0.0
    word_count: int = 0
    sections_detected: List[str] = []


class ResumeModel(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    user_id: str
    filename: str
    original_filename: str
    file_type: str  # pdf | docx
    file_size_bytes: int
    storage_path: str
    status: ResumeStatus = ResumeStatus.PENDING
    parsed_data: Optional[ParsedResumeData] = None
    parse_error: Optional[str] = None
    ats_score_history: List[Dict] = []
    tags: List[str] = []
    is_primary: bool = False
    version: int = 1
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
