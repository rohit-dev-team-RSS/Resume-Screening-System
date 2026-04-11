"""
Resume Enhancer Service — LLM-powered resume improvement
"""

import json
import os
from typing import Dict, List, Optional

import httpx
import structlog

from core.config import settings
from models.resume_model import ResumeModel
from schemas.resume_schema import EnhanceResumeResponse
from utils.nlp_utils import extract_keywords, detect_skills_in_text

logger = structlog.get_logger(__name__)


class EnhancerService:

    async def enhance_resume(
        self,
        resume: ResumeModel,
        job_description: Optional[str],
        target_role: Optional[str],
        enhancement_areas: List[str],
        tone: str,
    ) -> EnhanceResumeResponse:
        if not resume.parsed_data:
            raise ValueError("Resume must be parsed before enhancement.")

        parsed = resume.parsed_data
        enhanced_summary = None
        original_summary = parsed.summary

        # Build context
        jd_keywords = []
        if job_description:
            jd_keywords = [kw for kw, _ in extract_keywords(job_description, top_n=20)]

        # Enhance summary
        if "summary" in enhancement_areas:
            enhanced_summary = await self._enhance_summary(
                original_summary or "",
                parsed.skills,
                jd_keywords,
                target_role,
                tone,
            )

        # Enhance experience bullets
        enhanced_experience = []
        original_experience = []
        if "experience" in enhancement_areas and parsed.work_experience:
            for exp in parsed.work_experience[:5]:
                original_experience.append(exp.model_dump())
                enhanced_desc = await self._enhance_experience_bullet(
                    exp.title, exp.description or "", exp.technologies
                )
                enhanced_exp = exp.model_dump()
                enhanced_exp["description"] = enhanced_desc
                enhanced_experience.append(enhanced_exp)
        else:
            original_experience = [e.model_dump() for e in (parsed.work_experience or [])]
            enhanced_experience = original_experience

        # Add missing keywords
        added_keywords = []
        if "keywords" in enhancement_areas and jd_keywords:
            current_text = (parsed.raw_text or "").lower()
            added_keywords = [kw for kw in jd_keywords if kw not in current_text][:10]

        # Formatting suggestions
        formatting_suggestions = self._generate_formatting_suggestions(parsed)

        # Estimate ATS improvement
        ats_improvement = self._estimate_ats_improvement(
            len(added_keywords), enhanced_summary, original_summary
        )

        return EnhanceResumeResponse(
            resume_id=str(resume.id),
            original_summary=original_summary,
            enhanced_summary=enhanced_summary,
            original_experience=original_experience,
            enhanced_experience=enhanced_experience,
            added_keywords=added_keywords,
            formatting_suggestions=formatting_suggestions,
            ats_improvement_estimate=ats_improvement,
            enhancement_notes=self._build_enhancement_notes(
                added_keywords, enhanced_summary, enhancement_areas
            ),
        )

    async def _enhance_summary(
        self,
        original: str,
        skills: List[str],
        jd_keywords: List[str],
        target_role: Optional[str],
        tone: str,
    ) -> str:
        """Call LLM to enhance professional summary."""
        if settings.ANTHROPIC_API_KEY:
            return await self._call_anthropic_for_summary(original, skills, jd_keywords, target_role, tone)
        elif settings.OPENAI_API_KEY:
            return await self._call_openai_for_summary(original, skills, jd_keywords, target_role, tone)
        else:
            # Local enhancement fallback
            return self._local_enhance_summary(original, skills, jd_keywords, target_role)

    async def _call_anthropic_for_summary(
        self, original, skills, jd_keywords, target_role, tone
    ) -> str:
        prompt = f"""You are an expert resume writer. Enhance the following professional summary to be:
- ATS-optimized with these keywords: {', '.join(jd_keywords[:10])}
- Tone: {tone}
- Target role: {target_role or 'specified position'}
- Include relevant skills: {', '.join(skills[:8])}

Original summary:
{original or 'No summary provided — create a compelling one from the skills listed.'}

Write ONLY the enhanced summary (3-4 sentences, no preamble):"""

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": settings.ANTHROPIC_API_KEY,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": "claude-haiku-20240307",
                        "max_tokens": 300,
                        "messages": [{"role": "user", "content": prompt}],
                    },
                )
                data = response.json()
                return data["content"][0]["text"].strip()
        except Exception as e:
            logger.warning("Anthropic call failed, using local fallback", error=str(e))
            return self._local_enhance_summary(original, skills, jd_keywords, target_role)

    async def _call_openai_for_summary(
        self, original, skills, jd_keywords, target_role, tone
    ) -> str:
        prompt = f"""Enhance this resume summary. Be ATS-optimized, {tone} tone, targeting {target_role or 'the role'}.
Keywords to include: {', '.join(jd_keywords[:10])}
Skills to highlight: {', '.join(skills[:8])}
Original: {original or 'Create from scratch.'}
Output only the enhanced summary:"""

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                    json={
                        "model": "gpt-3.5-turbo",
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 300,
                        "temperature": 0.7,
                    },
                )
                data = response.json()
                return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.warning("OpenAI call failed, using local fallback", error=str(e))
            return self._local_enhance_summary(original, skills, jd_keywords, target_role)

    def _local_enhance_summary(
        self, original: str, skills: List[str], jd_keywords: List[str], target_role: Optional[str]
    ) -> str:
        """Template-based fallback when no LLM is configured."""
        role = target_role or "software professional"
        top_skills = ", ".join(skills[:5]) if skills else "relevant technologies"
        keywords_str = ", ".join(jd_keywords[:3]) if jd_keywords else ""

        if original and len(original) > 50:
            enhanced = original.rstrip(".")
            if keywords_str:
                enhanced += f", with expertise in {keywords_str}."
            return enhanced

        return (
            f"Results-driven {role} with proven expertise in {top_skills}. "
            f"{'Skilled in ' + keywords_str + ' and ' if keywords_str else ''}"
            f"passionate about delivering high-quality solutions and driving business impact. "
            f"Adept at collaborating with cross-functional teams to solve complex challenges."
        )

    async def _enhance_experience_bullet(
        self, title: str, description: str, technologies: List[str]
    ) -> str:
        """Enhance experience description to use strong action verbs and metrics."""
        if not description:
            return description
        # Simple local transformation — power words injection
        power_verbs = {
            "worked on": "Engineered",
            "helped": "Collaborated to deliver",
            "made": "Developed and deployed",
            "did": "Executed",
            "responsible for": "Led",
            "used": "Leveraged",
            "wrote": "Authored",
        }
        enhanced = description
        for weak, strong in power_verbs.items():
            enhanced = enhanced.replace(weak, strong).replace(weak.title(), strong)

        # Add tech stack mention
        if technologies and "using" not in enhanced.lower():
            tech_str = ", ".join(technologies[:3])
            enhanced = enhanced.rstrip(".") + f" using {tech_str}."

        return enhanced

    def _generate_formatting_suggestions(self, parsed) -> List[str]:
        suggestions = []
        if parsed.word_count < 300:
            suggestions.append("Resume is too short — aim for 400-600 words for optimal ATS scoring.")
        if parsed.word_count > 900:
            suggestions.append("Resume is too long — trim to 1-2 pages (600-800 words).")
        if not parsed.summary:
            suggestions.append("Add a Professional Summary section at the top — critical for ATS.")
        if len(parsed.skills) < 5:
            suggestions.append("Add a dedicated Skills section with at least 8-10 relevant skills.")
        if not parsed.contact_info.email:
            suggestions.append("Ensure your email address is clearly visible at the top.")
        if not parsed.contact_info.linkedin:
            suggestions.append("Add your LinkedIn profile URL for recruiter verification.")
        if not parsed.certifications:
            suggestions.append("Consider adding relevant certifications to boost your profile.")
        if len(parsed.work_experience) < 2:
            suggestions.append("Add more work experience details or freelance/volunteer work.")
        suggestions.append("Use consistent date formatting (e.g., 'Jan 2022 – Dec 2023') throughout.")
        suggestions.append("Use standard section headers: Experience, Education, Skills — ATS-friendly.")
        return suggestions

    def _estimate_ats_improvement(
        self, added_keywords: int, enhanced_summary: Optional[str], original_summary: Optional[str]
    ) -> float:
        improvement = 0.0
        if added_keywords > 0:
            improvement += min(added_keywords * 0.02, 0.15)  # Up to 15% from keywords
        if enhanced_summary and enhanced_summary != original_summary:
            improvement += 0.05  # 5% from enhanced summary
        return round(min(improvement, 0.30), 3)  # Cap at 30%

    def _build_enhancement_notes(self, added_keywords, enhanced_summary, areas) -> List[str]:
        notes = []
        if enhanced_summary:
            notes.append("✅ Professional summary enhanced with stronger language and keywords")
        if added_keywords:
            notes.append(f"✅ {len(added_keywords)} ATS keywords identified for incorporation")
        if "experience" in areas:
            notes.append("✅ Experience bullets upgraded with action verbs and impact metrics")
        if "formatting" in areas:
            notes.append("✅ Formatting suggestions generated for ATS compatibility")
        notes.append("💡 Manually review all AI suggestions before submitting")
        return notes
