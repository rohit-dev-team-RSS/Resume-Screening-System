"""
Input Validators — reusable validation helpers
"""

import re
from typing import Optional
from bson import ObjectId


def is_valid_object_id(value: str) -> bool:
    try:
        ObjectId(value)
        return True
    except Exception:
        return False


def validate_object_id(value: str, field_name: str = "ID") -> str:
    if not is_valid_object_id(value):
        raise ValueError(f"Invalid {field_name}: '{value}' is not a valid MongoDB ObjectId")
    return value


def is_valid_github_username(username: str) -> bool:
    pattern = r"^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$"
    return bool(re.match(pattern, username))


def is_valid_url(url: str) -> bool:
    pattern = r"https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+"
    return bool(re.match(pattern, url))


def clamp(value: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    return max(min_val, min(max_val, value))


def normalize_score(score: float) -> float:
    return round(clamp(score), 4)


def score_to_label(score: float) -> str:
    if score >= 0.80:
        return "strong_match"
    elif score >= 0.65:
        return "good_match"
    elif score >= 0.45:
        return "partial_match"
    else:
        return "poor_match"


def score_to_grade(score: float) -> str:
    if score >= 0.90:
        return "A+"
    elif score >= 0.80:
        return "A"
    elif score >= 0.70:
        return "B"
    elif score >= 0.60:
        return "C"
    elif score >= 0.50:
        return "D"
    else:
        return "F"
