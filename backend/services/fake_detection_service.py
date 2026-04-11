"""
Fake Experience Detector — Authenticity analysis using heuristics + NLP signals
"""

import re
from typing import List, Optional

import structlog

from models.resume_model import ResumeModel

logger = structlog.get_logger(__name__)

# ─── Red Flag Patterns ────────────────────────────────────────────────────────
VAGUE_PHRASES = [
    "responsible for many things", "worked with various technologies",
    "helped the team", "did various tasks", "handled multiple projects",
    "worked on different things", "assisted with development",
    "participated in meetings", "supported the team",
]

BUZZWORD_OVERLOAD = [
    "synergy", "leverage", "paradigm shift", "disruptive", "revolutionary",
    "cutting-edge", "world-class", "best-in-class", "state-of-the-art",
    "next-generation", "transformational", "game-changing",
]

IMPOSSIBLE_SKILLS = {
    # Skill → max reasonable years of existence
    "kubernetes": 2014, "docker": 2013, "react": 2013, "fastapi": 2018,
    "tensorflow": 2015, "pytorch": 2016, "langchain": 2022,
    "nextjs": 2016, "typescript": 2012, "rust": 2015, "go": 2012,
}

TITLE_INFLATION_MAP = {
    "chief ai officer": 0.2,
    "head of ai": 0.3,
    "vp of engineering": 0.3,
    "principal architect": 0.25,
    "founding engineer": 0.2,
}


class FakeDetectionService:

    async def analyze(self, resume: ResumeModel, github_data: Optional[dict] = None) -> dict:
        if not resume.parsed_data:
            raise ValueError("Resume must be parsed before fake detection.")

        parsed = resume.parsed_data
        red_flags = []
        trust_boosters = []
        risk_scores = {}

        # ── Check 1: Date Inconsistencies ─────────────────────────────────────
        date_flags, date_score = self._check_date_consistency(parsed.work_experience)
        red_flags.extend(date_flags)
        risk_scores["date_consistency"] = date_score

        # ── Check 2: Skill Timeline Validity ─────────────────────────────────
        skill_flags, skill_score = self._check_skill_timeline(parsed.work_experience, parsed.skills)
        red_flags.extend(skill_flags)
        risk_scores["skill_timeline"] = skill_score

        # ── Check 3: Vague Language Detection ────────────────────────────────
        vague_flags, vague_score = self._check_vague_language(parsed.raw_text)
        red_flags.extend(vague_flags)
        risk_scores["language_quality"] = vague_score

        # ── Check 4: Experience Progression Sanity ────────────────────────────
        prog_flags, prog_score = self._check_career_progression(parsed.work_experience)
        red_flags.extend(prog_flags)
        risk_scores["career_progression"] = prog_score

        # ── Check 5: Education Verification Signals ───────────────────────────
        edu_flags, edu_score = self._check_education(parsed.education)
        red_flags.extend(edu_flags)
        risk_scores["education_signals"] = edu_score

        # ── Check 6: GitHub Correlation ───────────────────────────────────────
        if github_data:
            gh_flags, gh_score, gh_boosts = self._correlate_with_github(parsed, github_data)
            red_flags.extend(gh_flags)
            trust_boosters.extend(gh_boosts)
            risk_scores["github_correlation"] = gh_score
        else:
            risk_scores["github_correlation"] = 0.5  # Neutral — no data

        # ── Check 7: Contact Verifiability ────────────────────────────────────
        contact_score = self._check_contact_completeness(parsed.contact_info)
        risk_scores["contact_verifiability"] = contact_score
        if contact_score < 0.4:
            red_flags.append("⚠️ Limited contact information — no LinkedIn or GitHub provided.")
        elif contact_score >= 0.8:
            trust_boosters.append("✅ Complete contact info with verifiable LinkedIn/GitHub links")

        # ── Compute Overall Authenticity ──────────────────────────────────────
        weights = {
            "date_consistency": 0.25,
            "skill_timeline": 0.20,
            "language_quality": 0.15,
            "career_progression": 0.20,
            "education_signals": 0.10,
            "github_correlation": 0.05,
            "contact_verifiability": 0.05,
        }
        authenticity_score = sum(
            weights[k] * risk_scores[k] for k in weights if k in risk_scores
        )
        authenticity_score = round(authenticity_score, 3)

        verdict = self._compute_verdict(authenticity_score, red_flags)

        return {
            "resume_id": str(resume.id),
            "authenticity_score": authenticity_score,
            "verdict": verdict,
            "risk_level": self._risk_level(authenticity_score),
            "red_flags": red_flags,
            "trust_boosters": trust_boosters,
            "risk_breakdown": risk_scores,
            "recommendations": self._build_recommendations(red_flags, authenticity_score),
            "detailed_analysis": {
                "total_experience_years": parsed.total_experience_years,
                "total_roles": len(parsed.work_experience),
                "total_skills": len(parsed.skills),
                "has_github": bool(parsed.contact_info.github),
                "has_linkedin": bool(parsed.contact_info.linkedin),
            },
        }

    # ── Checker Methods ───────────────────────────────────────────────────────
    def _check_date_consistency(self, experiences) -> tuple[List[str], float]:
        flags = []
        if not experiences:
            return flags, 0.5

        # Check for overlapping date ranges
        date_pairs = []
        for exp in experiences:
            if exp.start_date and exp.end_date:
                date_pairs.append((exp.start_date, exp.end_date, exp.company))

        # Simple overlap detection (heuristic — full parsing would use dateutil)
        overlap_count = 0
        for i in range(len(date_pairs) - 1):
            s1, e1, c1 = date_pairs[i]
            s2, e2, c2 = date_pairs[i + 1]
            # If start2 < end1 (same year), potential overlap
            if s2 and e1 and s2[:4] == e1[:4] and e1.lower() not in ("present", "current"):
                overlap_count += 1

        if overlap_count > 0:
            flags.append(f"⚠️ Potential date overlap detected in {overlap_count} role(s) — verify timeline accuracy.")

        score = max(0.4, 1.0 - overlap_count * 0.3)
        return flags, round(score, 2)

    def _check_skill_timeline(self, experiences, skills) -> tuple[List[str], float]:
        flags = []
        current_year = 2025

        for skill in skills:
            first_year = IMPOSSIBLE_SKILLS.get(skill.lower())
            if not first_year:
                continue
            # Check if any experience claims this skill before it existed
            for exp in experiences:
                start = exp.start_date or ""
                year_match = re.search(r"(19|20)\d{2}", start)
                if year_match:
                    claimed_year = int(year_match.group(0))
                    if claimed_year < first_year:
                        flags.append(
                            f"⚠️ Impossible claim: {skill.title()} (released {first_year}) listed in role starting {claimed_year}."
                        )

        score = max(0.3, 1.0 - len(flags) * 0.2)
        return flags, round(score, 2)

    def _check_vague_language(self, text: str) -> tuple[List[str], float]:
        flags = []
        text_lower = text.lower()
        vague_count = sum(1 for phrase in VAGUE_PHRASES if phrase in text_lower)
        buzzword_count = sum(1 for bw in BUZZWORD_OVERLOAD if bw in text_lower)

        if vague_count >= 3:
            flags.append(f"⚠️ High use of vague language ({vague_count} generic phrases detected) — lacks specificity.")
        if buzzword_count >= 5:
            flags.append(f"⚠️ Excessive buzzword usage ({buzzword_count} detected) — may indicate inflated claims.")

        # Positive signal: quantified achievements
        metrics_count = len(re.findall(r"\d+%|\$\d+|\d+x\b|\d+\s*(?:million|billion|thousand)", text_lower))
        if metrics_count >= 3:
            score = 1.0
        elif metrics_count >= 1:
            score = 0.75
        else:
            score = max(0.4, 1.0 - (vague_count + buzzword_count) * 0.1)

        return flags, round(score, 2)

    def _check_career_progression(self, experiences) -> tuple[List[str], float]:
        flags = []
        if not experiences:
            return flags, 0.5

        # Too many senior roles too early
        senior_titles = {"senior", "lead", "principal", "staff", "director", "vp", "head of", "chief"}
        senior_count = sum(
            1 for exp in experiences
            if any(s in (exp.title or "").lower() for s in senior_titles)
        )

        total = len(experiences)
        if total > 0 and senior_count / total > 0.8 and total > 2:
            flags.append("⚠️ Unusually high proportion of senior/leadership titles — verify accuracy.")

        # Title jumps (e.g., intern → VP in one step)
        titles = [e.title.lower() for e in experiences if e.title]
        if len(titles) >= 2:
            if "intern" in titles[-1] and any(t in titles[0] for t in ["vp", "director", "chief"]):
                flags.append("⚠️ Suspicious career trajectory — extreme title jump detected.")

        score = max(0.5, 1.0 - len(flags) * 0.25)
        return flags, round(score, 2)

    def _check_education(self, education) -> tuple[List[str], float]:
        flags = []
        if not education:
            flags.append("⚠️ No education information provided.")
            return flags, 0.4

        for edu in education:
            if edu.gpa and edu.gpa > 4.0:
                flags.append(f"⚠️ GPA {edu.gpa} exceeds standard 4.0 scale — verify grading system.")
            if edu.start_year and edu.end_year:
                duration = edu.end_year - edu.start_year
                if duration < 1 and edu.degree and "bachelor" in (edu.degree or "").lower():
                    flags.append("⚠️ Bachelor's degree duration < 1 year — verify dates.")
                if duration > 8:
                    flags.append(f"⚠️ Unusually long study duration ({duration} years) — clarify if part-time.")

        score = max(0.5, 1.0 - len(flags) * 0.2)
        return flags, round(score, 2)

    def _correlate_with_github(self, parsed, github_data) -> tuple[List[str], float, List[str]]:
        flags = []
        boosters = []

        claimed_tech = set(s.lower() for s in parsed.technical_skills)
        github_langs = set(lang.lower() for lang in github_data.get("languages", {}).keys())

        overlap = claimed_tech & github_langs
        if len(claimed_tech) > 0:
            correlation_rate = len(overlap) / len(claimed_tech)
        else:
            correlation_rate = 0.5

        if correlation_rate >= 0.6:
            boosters.append(f"✅ GitHub languages strongly corroborate claimed skills ({len(overlap)} matching)")
        elif correlation_rate < 0.3 and len(claimed_tech) > 3:
            flags.append("⚠️ GitHub languages don't align with claimed technical skills — low correlation.")

        contribution_score = github_data.get("contribution_score", 0)
        if contribution_score >= 0.6:
            boosters.append("✅ Strong GitHub contribution history — experience appears credible")

        score = 0.5 + correlation_rate * 0.5
        return flags, round(score, 2), boosters

    def _check_contact_completeness(self, contact) -> float:
        score = 0.0
        if contact.email:
            score += 0.3
        if contact.phone:
            score += 0.1
        if contact.linkedin:
            score += 0.35
        if contact.github:
            score += 0.25
        return round(score, 2)

    def _compute_verdict(self, score: float, red_flags: List[str]) -> str:
        critical_flags = [f for f in red_flags if "impossible" in f.lower() or "suspicious" in f.lower()]
        if critical_flags:
            return "suspicious"
        if score >= 0.80:
            return "authentic"
        elif score >= 0.60:
            return "likely_authentic"
        elif score >= 0.40:
            return "uncertain"
        else:
            return "suspicious"

    def _risk_level(self, score: float) -> str:
        if score >= 0.80:
            return "low"
        elif score >= 0.60:
            return "moderate"
        else:
            return "high"

    def _build_recommendations(self, red_flags: List[str], score: float) -> List[str]:
        recs = []
        if score < 0.60:
            recs.append("🔍 Request official employment verification letters for flagged roles.")
            recs.append("🔍 Verify education credentials through official institution contact.")
        if any("github" in f.lower() for f in red_flags):
            recs.append("🔍 Request a GitHub portfolio walkthrough during technical interview.")
        if score >= 0.80:
            recs.append("✅ Resume appears credible. Standard verification recommended.")
        recs.append("📞 Conduct reference checks with at least 2 previous managers.")
        return recs
