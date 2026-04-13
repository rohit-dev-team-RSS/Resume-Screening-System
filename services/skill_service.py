"""
Skill Intelligence Service — Gap analysis, learning paths, market demand
"""

from typing import Dict, List, Optional, Tuple

import structlog

from models.resume_model import ResumeModel
from schemas.ats_schema import (
    SkillAnalysisResponse, SkillGapDetail, LearningPathStep, LearningResource
)
from utils.nlp_utils import detect_skills_in_text, TECH_SKILLS

logger = structlog.get_logger(__name__)

# ─── Market Demand Data (Production: pull from job board API) ─────────────────
MARKET_DEMAND = {
    "python": 0.95, "javascript": 0.93, "typescript": 0.88,
    "react": 0.90, "docker": 0.88, "kubernetes": 0.82,
    "aws": 0.91, "sql": 0.87, "fastapi": 0.75, "django": 0.73,
    "tensorflow": 0.78, "pytorch": 0.80, "langchain": 0.72,
    "go": 0.76, "rust": 0.68, "java": 0.83, "spring": 0.75,
    "nextjs": 0.82, "graphql": 0.71, "redis": 0.79, "mongodb": 0.76,
    "elasticsearch": 0.72, "kafka": 0.74, "spark": 0.71,
    "machine learning": 0.85, "deep learning": 0.80, "nlp": 0.78,
    "git": 0.97, "linux": 0.88, "ci/cd": 0.84, "terraform": 0.77,
}

# ─── Curated Learning Resources ───────────────────────────────────────────────
LEARNING_RESOURCES: Dict[str, List[dict]] = {
    "python": [
        {"title": "Python for Everybody (Coursera)", "url": "https://coursera.org/specializations/python", "platform": "Coursera", "type": "course", "duration": "8 weeks", "cost": "freemium"},
        {"title": "Real Python Tutorials", "url": "https://realpython.com", "platform": "Real Python", "type": "tutorial", "cost": "freemium"},
        {"title": "Automate the Boring Stuff", "url": "https://automatetheboringstuff.com", "platform": "Book", "type": "book", "cost": "free"},
    ],
    "docker": [
        {"title": "Docker Mastery (Udemy)", "url": "https://udemy.com/course/docker-mastery/", "platform": "Udemy", "type": "course", "duration": "19 hrs", "cost": "paid"},
        {"title": "Docker Official Tutorial", "url": "https://docs.docker.com/get-started/", "platform": "Docker", "type": "tutorial", "cost": "free"},
    ],
    "kubernetes": [
        {"title": "Kubernetes for Developers (LFS158)", "url": "https://training.linuxfoundation.org/training/introduction-to-kubernetes/", "platform": "Linux Foundation", "type": "course", "cost": "free"},
        {"title": "CKA Exam Prep", "url": "https://kodekloud.com/courses/certified-kubernetes-administrator-cka/", "platform": "KodeKloud", "type": "certification", "cost": "paid"},
    ],
    "aws": [
        {"title": "AWS Cloud Practitioner Essentials", "url": "https://aws.amazon.com/training/", "platform": "AWS", "type": "certification", "duration": "6 hrs", "cost": "free"},
        {"title": "AWS Solutions Architect Associate", "url": "https://acloudguru.com", "platform": "A Cloud Guru", "type": "course", "cost": "paid"},
    ],
    "react": [
        {"title": "React Official Docs", "url": "https://react.dev/learn", "platform": "React", "type": "tutorial", "cost": "free"},
        {"title": "The Complete React Developer (Udemy)", "url": "https://udemy.com/course/complete-react-developer-zero-to-mastery/", "platform": "Udemy", "type": "course", "cost": "paid"},
    ],
    "machine learning": [
        {"title": "ML Specialization (Coursera - Andrew Ng)", "url": "https://coursera.org/specializations/machine-learning-introduction", "platform": "Coursera", "type": "course", "duration": "11 weeks", "cost": "freemium"},
        {"title": "Fast.ai Practical ML", "url": "https://course.fast.ai", "platform": "Fast.ai", "type": "course", "cost": "free"},
    ],
    "sql": [
        {"title": "SQL for Data Science (Coursera)", "url": "https://coursera.org/learn/sql-for-data-science", "platform": "Coursera", "type": "course", "cost": "freemium"},
        {"title": "SQLZoo", "url": "https://sqlzoo.net", "platform": "SQLZoo", "type": "tutorial", "cost": "free"},
    ],
}

# ─── Skill Complexity Map ─────────────────────────────────────────────────────
SKILL_WEEKS = {
    "python": 6, "javascript": 8, "typescript": 4, "react": 6,
    "docker": 3, "kubernetes": 10, "aws": 12, "sql": 4,
    "machine learning": 16, "tensorflow": 10, "pytorch": 10,
    "go": 8, "rust": 12, "java": 10, "spring": 8,
    "nextjs": 4, "graphql": 3, "redis": 2, "mongodb": 3,
    "kafka": 6, "spark": 8, "terraform": 5, "ci/cd": 4,
}


class SkillService:

    async def analyze_skills(
        self,
        resume: ResumeModel,
        target_role: Optional[str] = None,
        industry: Optional[str] = None,
    ) -> SkillAnalysisResponse:
        if not resume.parsed_data:
            raise ValueError("Resume must be parsed before skill analysis.")

        current_tech = resume.parsed_data.technical_skills
        current_soft = resume.parsed_data.soft_skills
        all_skills = resume.parsed_data.skills

        # Determine target skills based on role
        target_skills = self._get_role_skills(target_role or "software engineer")

        # Identify gaps
        current_set = set(s.lower() for s in all_skills)
        gaps = []
        for skill in target_skills:
            if skill not in current_set:
                detail = self._build_gap_detail(skill, current_set)
                gaps.append(detail)

        # Sort gaps by importance
        gaps.sort(key=lambda g: (g.importance != "critical", g.importance != "important"))

        # Build learning path
        learning_path = self._build_learning_path(gaps)

        # Market demand
        market_demand = self._compute_market_demand(all_skills, target_skills)

        total_weeks = sum(g.estimated_weeks for g in gaps[:8])

        return SkillAnalysisResponse(
            resume_id=str(resume.id),
            current_skills=all_skills,
            technical_skills=current_tech,
            soft_skills=current_soft,
            skill_gaps=gaps[:15],
            learning_path=learning_path[:20],
            estimated_upskilling_weeks=total_weeks,
            market_demand_score=market_demand,
            top_missing_skills=[g.skill for g in gaps[:5]],
        )

    def _get_role_skills(self, role: str) -> List[str]:
        role_map = {
            "software engineer": ["python", "javascript", "sql", "git", "docker", "aws", "react", "ci/cd"],
            "data scientist": ["python", "sql", "machine learning", "tensorflow", "pandas", "spark", "aws"],
            "devops engineer": ["docker", "kubernetes", "terraform", "aws", "ci/cd", "linux", "python", "ansible"],
            "frontend developer": ["react", "typescript", "nextjs", "css", "git", "graphql", "figma"],
            "backend developer": ["python", "fastapi", "sql", "mongodb", "redis", "docker", "aws"],
            "ml engineer": ["python", "pytorch", "tensorflow", "mlops", "docker", "kubernetes", "sql"],
            "full stack developer": ["react", "nextjs", "python", "fastapi", "sql", "docker", "aws", "git"],
        }
        role_lower = role.lower()
        for key, skills in role_map.items():
            if any(word in role_lower for word in key.split()):
                return skills
        return list(TECH_SKILLS)[:12]

    def _build_gap_detail(self, skill: str, current_set: set) -> SkillGapDetail:
        importance = self._determine_importance(skill)
        resources_raw = LEARNING_RESOURCES.get(skill.lower(), [
            {"title": f"Learn {skill.title()} on Coursera", "url": f"https://coursera.org/search?query={skill.replace(' ', '+')}", "platform": "Coursera", "type": "course", "cost": "freemium"},
        ])
        resources = [LearningResource(**r) for r in resources_raw]
        return SkillGapDetail(
            skill=skill,
            importance=importance,
            current_level="none",
            target_level="intermediate",
            resources=resources,
            estimated_weeks=SKILL_WEEKS.get(skill.lower(), 6),
        )

    def _determine_importance(self, skill: str) -> str:
        critical = {"python", "javascript", "sql", "git", "docker", "aws", "react", "java"}
        important = {"kubernetes", "typescript", "mongodb", "redis", "graphql", "terraform"}
        if skill.lower() in critical:
            return "critical"
        if skill.lower() in important:
            return "important"
        return "nice_to_have"

    def _build_learning_path(self, gaps: List[SkillGapDetail]) -> List[LearningPathStep]:
        path = []
        week = 1
        for gap in gaps[:10]:
            resource_titles = [r.title for r in gap.resources[:2]]
            path.append(LearningPathStep(
                week=week,
                skill=gap.skill,
                action=f"Start learning {gap.skill.title()}",
                resources=resource_titles,
                milestone=f"Complete beginner project in {gap.skill.title()}",
            ))
            week += gap.estimated_weeks
        return path

    def _compute_market_demand(self, current_skills: List[str], target_skills: List[str]) -> float:
        if not current_skills:
            return 0.0
        total_demand = sum(MARKET_DEMAND.get(s.lower(), 0.5) for s in current_skills)
        avg = total_demand / len(current_skills)
        return round(avg, 3)
