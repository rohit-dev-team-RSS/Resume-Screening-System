"""
Cheating Detection Service — Tracks and scores suspicious behavior during interviews
"""

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

import structlog

logger = structlog.get_logger(__name__)

# ─── Event Models ─────────────────────────────────────────────────────────────
class CheatingEvent(BaseModel):
    event_type: str          # tab_switch | window_blur | no_face | multiple_faces | look_away | copy_paste
    timestamp: str
    severity: str = "medium" # low | medium | high | critical
    details: Optional[str] = None
    question_number: Optional[int] = None

class CheatingReport(BaseModel):
    session_id: str
    events: List[CheatingEvent]
    total_events: int
    cheating_score: float     # 0.0 – 1.0
    risk_level: str           # low | medium | high | critical
    warnings: List[str]
    verdict: str
    breakdown: Dict[str, int]


# ─── Weights per event type ───────────────────────────────────────────────────
EVENT_WEIGHTS = {
    "tab_switch":      0.15,
    "window_blur":     0.08,
    "no_face":         0.10,
    "multiple_faces":  0.20,
    "look_away":       0.05,
    "copy_paste":      0.18,
    "right_click":     0.04,
    "devtools_open":   0.20,
    "phone_detected":  0.12,
}

SEVERITY_MULTIPLIERS = {
    "low": 0.5,
    "medium": 1.0,
    "high": 1.5,
    "critical": 2.5,
}


class CheatingDetectionService:

    def analyze_session(self, session_id: str, events: List[Dict]) -> CheatingReport:
        """Compute cheating score from list of flagged events."""
        parsed_events = [CheatingEvent(**e) if isinstance(e, dict) else e for e in events]

        breakdown: Dict[str, int] = {}
        raw_score = 0.0
        warnings = []

        for ev in parsed_events:
            breakdown[ev.event_type] = breakdown.get(ev.event_type, 0) + 1
            weight = EVENT_WEIGHTS.get(ev.event_type, 0.05)
            multiplier = SEVERITY_MULTIPLIERS.get(ev.severity, 1.0)
            raw_score += weight * multiplier

        # Diminishing returns — cap at 1.0
        cheating_score = round(min(1.0, raw_score), 3)
        risk_level = self._risk_level(cheating_score)
        warnings = self._build_warnings(breakdown, cheating_score)
        verdict = self._verdict(cheating_score, breakdown)

        logger.info("Cheating analysis", session_id=session_id, score=cheating_score, risk=risk_level)

        return CheatingReport(
            session_id=session_id,
            events=parsed_events,
            total_events=len(parsed_events),
            cheating_score=cheating_score,
            risk_level=risk_level,
            warnings=warnings,
            verdict=verdict,
            breakdown=breakdown,
        )

    def _risk_level(self, score: float) -> str:
        if score >= 0.65: return "critical"
        if score >= 0.40: return "high"
        if score >= 0.20: return "medium"
        return "low"

    def _verdict(self, score: float, breakdown: dict) -> str:
        critical_events = breakdown.get("devtools_open", 0) + breakdown.get("multiple_faces", 0)
        if critical_events >= 2 or score >= 0.65:
            return "Session flagged for review — significant integrity concerns detected."
        if score >= 0.40:
            return "Session requires manual review — multiple suspicious behaviors observed."
        if score >= 0.20:
            return "Minor irregularities detected — session is conditionally valid."
        return "Session passed integrity check with no significant concerns."

    def _build_warnings(self, breakdown: dict, score: float) -> List[str]:
        warnings = []
        if breakdown.get("tab_switch", 0) > 0:
            warnings.append(f"Tab switching detected {breakdown['tab_switch']} time(s) — possible content lookup.")
        if breakdown.get("multiple_faces", 0) > 0:
            warnings.append(f"Multiple faces detected in {breakdown['multiple_faces']} instance(s) — potential external assistance.")
        if breakdown.get("no_face", 0) >= 3:
            warnings.append(f"Candidate absent from camera {breakdown['no_face']} time(s) — video presence required.")
        if breakdown.get("devtools_open", 0) > 0:
            warnings.append("Browser DevTools opened during session — highly suspicious.")
        if breakdown.get("copy_paste", 0) >= 2:
            warnings.append(f"Copy-paste detected {breakdown['copy_paste']} time(s) — may indicate external assistance.")
        if breakdown.get("window_blur", 0) >= 3:
            warnings.append(f"Window lost focus {breakdown['window_blur']} time(s) — candidate left interview window.")
        return warnings or ["No significant violations detected."]
