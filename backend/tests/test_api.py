"""
Test Suite — API integration tests using pytest-asyncio + httpx
Run: pytest tests/ -v --asyncio-mode=auto
"""

import asyncio
import pytest
from httpx import AsyncClient, ASGITransport

# ─── Override settings BEFORE importing app ───────────────────────────────────
import os
os.environ["MONGO_URI"] = "mongodb://localhost:27017"
os.environ["MONGO_DB_NAME"] = "ai_career_test"
os.environ["SECRET_KEY"] = "test-secret-key-do-not-use-in-production-12345"
os.environ["DEBUG"] = "true"
os.environ["ENVIRONMENT"] = "development"

from main import app

# ─── Fixtures ─────────────────────────────────────────────────────────────────
BASE_URL = "http://test"
API = "/api/v1"

CANDIDATE_USER = {
    "email": "test.candidate@example.com",
    "password": "TestPass123!",
    "full_name": "Jane Doe",
    "role": "candidate",
}

RECRUITER_USER = {
    "email": "test.recruiter@example.com",
    "password": "RecruiterPass123!",
    "full_name": "Bob Smith",
    "role": "recruiter",
}

SAMPLE_JD = """
We are looking for a Senior Python Developer with 5+ years of experience.
Required Skills: Python, FastAPI, MongoDB, Docker, AWS, Redis, PostgreSQL.
Preferred: Kubernetes, Terraform, CI/CD, React.
The ideal candidate will design and build scalable microservices, collaborate
with cross-functional teams, and mentor junior developers.
Strong knowledge of REST APIs, async programming, and cloud infrastructure is required.
"""


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL) as c:
        yield c


@pytest.fixture(scope="session")
async def candidate_token(client):
    """Register + login a candidate, return access token."""
    # Signup
    r = await client.post(f"{API}/auth/signup", json=CANDIDATE_USER)
    if r.status_code == 409:  # Already exists
        r = await client.post(f"{API}/auth/login", json={
            "email": CANDIDATE_USER["email"],
            "password": CANDIDATE_USER["password"],
        })
    assert r.status_code in (200, 201), f"Auth failed: {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
async def recruiter_token(client):
    r = await client.post(f"{API}/auth/signup", json=RECRUITER_USER)
    if r.status_code == 409:
        r = await client.post(f"{API}/auth/login", json={
            "email": RECRUITER_USER["email"],
            "password": RECRUITER_USER["password"],
        })
    assert r.status_code in (200, 201)
    return r.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ═══════════════════════════════════════════════════════════════════════════════
# Health Tests
# ═══════════════════════════════════════════════════════════════════════════════
class TestHealth:
    async def test_root(self, client):
        r = await client.get("/")
        assert r.status_code == 200
        data = r.json()
        assert "name" in data
        assert "version" in data
        assert data["status"] == "running"

    async def test_health(self, client):
        r = await client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] in ("ok", "degraded")

    async def test_docs_available(self, client):
        r = await client.get("/docs")
        assert r.status_code == 200

    async def test_openapi_schema(self, client):
        r = await client.get("/openapi.json")
        assert r.status_code == 200
        schema = r.json()
        assert "paths" in schema
        assert "components" in schema


# ═══════════════════════════════════════════════════════════════════════════════
# Auth Tests
# ═══════════════════════════════════════════════════════════════════════════════
class TestAuth:
    async def test_signup_success(self, client):
        user = {
            "email": "new.user.xyz123@example.com",
            "password": "SecurePass123!",
            "full_name": "New User",
            "role": "candidate",
        }
        r = await client.post(f"{API}/auth/signup", json=user)
        assert r.status_code == 201
        data = r.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["email"] == user["email"]
        assert data["user"]["role"] == "candidate"

    async def test_signup_duplicate_email(self, client, candidate_token):
        r = await client.post(f"{API}/auth/signup", json=CANDIDATE_USER)
        assert r.status_code == 409

    async def test_signup_weak_password(self, client):
        r = await client.post(f"{API}/auth/signup", json={
            "email": "weak@example.com",
            "password": "weak",
            "full_name": "Weak User",
        })
        assert r.status_code == 422

    async def test_signup_invalid_email(self, client):
        r = await client.post(f"{API}/auth/signup", json={
            "email": "not-an-email",
            "password": "ValidPass123!",
            "full_name": "Test User",
        })
        assert r.status_code == 422

    async def test_login_success(self, client):
        r = await client.post(f"{API}/auth/login", json={
            "email": CANDIDATE_USER["email"],
            "password": CANDIDATE_USER["password"],
        })
        assert r.status_code == 200
        assert "access_token" in r.json()

    async def test_login_wrong_password(self, client):
        r = await client.post(f"{API}/auth/login", json={
            "email": CANDIDATE_USER["email"],
            "password": "WrongPassword!",
        })
        assert r.status_code == 401

    async def test_login_nonexistent_user(self, client):
        r = await client.post(f"{API}/auth/login", json={
            "email": "ghost@nobody.com",
            "password": "Pass123!",
        })
        assert r.status_code == 401

    async def test_get_me(self, client, candidate_token):
        r = await client.get(f"{API}/auth/me", headers=auth_headers(candidate_token))
        assert r.status_code == 200
        assert r.json()["email"] == CANDIDATE_USER["email"]

    async def test_me_unauthorized(self, client):
        r = await client.get(f"{API}/auth/me")
        assert r.status_code == 401

    async def test_update_profile(self, client, candidate_token):
        r = await client.put(
            f"{API}/auth/me",
            headers=auth_headers(candidate_token),
            json={"phone": "+1234567890", "github_username": "janedoe"},
        )
        assert r.status_code == 200
        assert r.json()["github_username"] == "janedoe"

    async def test_refresh_token(self, client, candidate_token):
        # First login to get refresh token
        r = await client.post(f"{API}/auth/login", json={
            "email": CANDIDATE_USER["email"],
            "password": CANDIDATE_USER["password"],
        })
        refresh_token = r.json()["refresh_token"]
        r2 = await client.post(f"{API}/auth/refresh", json={"refresh_token": refresh_token})
        assert r2.status_code == 200
        assert "access_token" in r2.json()

    async def test_invalid_token_rejected(self, client):
        r = await client.get(
            f"{API}/auth/me",
            headers={"Authorization": "Bearer totally.fake.token"},
        )
        assert r.status_code == 401


# ═══════════════════════════════════════════════════════════════════════════════
# Resume Tests (require file upload — use minimal PDF bytes)
# ═══════════════════════════════════════════════════════════════════════════════
class TestResume:
    async def test_list_resumes_empty(self, client, candidate_token):
        r = await client.get(f"{API}/resume/", headers=auth_headers(candidate_token))
        assert r.status_code == 200
        assert "resumes" in r.json()
        assert "total" in r.json()

    async def test_upload_invalid_file_type(self, client, candidate_token):
        r = await client.post(
            f"{API}/resume/upload",
            headers=auth_headers(candidate_token),
            files={"file": ("test.txt", b"plain text content", "text/plain")},
        )
        assert r.status_code == 415

    async def test_upload_empty_file(self, client, candidate_token):
        r = await client.post(
            f"{API}/resume/upload",
            headers=auth_headers(candidate_token),
            files={"file": ("empty.pdf", b"", "application/pdf")},
        )
        assert r.status_code in (400, 413, 415)

    async def test_get_nonexistent_resume(self, client, candidate_token):
        r = await client.get(
            f"{API}/resume/000000000000000000000000",
            headers=auth_headers(candidate_token),
        )
        assert r.status_code == 404

    async def test_invalid_resume_id_format(self, client, candidate_token):
        r = await client.get(
            f"{API}/resume/not-a-valid-id",
            headers=auth_headers(candidate_token),
        )
        assert r.status_code in (400, 422)


# ═══════════════════════════════════════════════════════════════════════════════
# ATS Tests
# ═══════════════════════════════════════════════════════════════════════════════
class TestATS:
    async def test_match_nonexistent_resume(self, client, candidate_token):
        r = await client.post(
            f"{API}/ats/match",
            headers=auth_headers(candidate_token),
            json={
                "resume_id": "000000000000000000000000",
                "job_title": "Python Developer",
                "job_description": SAMPLE_JD,
            },
        )
        assert r.status_code == 404

    async def test_match_short_jd_rejected(self, client, candidate_token):
        r = await client.post(
            f"{API}/ats/match",
            headers=auth_headers(candidate_token),
            json={
                "resume_id": "000000000000000000000000",
                "job_title": "Dev",
                "job_description": "Short",
            },
        )
        assert r.status_code == 422

    async def test_history_empty(self, client, candidate_token):
        r = await client.get(f"{API}/ats/history", headers=auth_headers(candidate_token))
        assert r.status_code == 200
        assert "items" in r.json()

    async def test_bulk_match_empty_ids(self, client, candidate_token):
        r = await client.post(
            f"{API}/ats/bulk-match",
            headers=auth_headers(candidate_token),
            json={"resume_ids": [], "job_title": "Dev", "job_description": SAMPLE_JD},
        )
        assert r.status_code == 422


# ═══════════════════════════════════════════════════════════════════════════════
# Skills Tests
# ═══════════════════════════════════════════════════════════════════════════════
class TestSkills:
    async def test_market_demand(self, client, candidate_token):
        r = await client.get(f"{API}/skills/market-demand", headers=auth_headers(candidate_token))
        assert r.status_code == 200
        data = r.json()
        assert "skills" in data
        assert len(data["skills"]) > 10
        first = data["skills"][0]
        assert "skill" in first
        assert "demand_score" in first
        assert "demand_level" in first

    async def test_analyze_skills_invalid_resume(self, client, candidate_token):
        r = await client.post(
            f"{API}/skills/analyze",
            headers=auth_headers(candidate_token),
            json={"resume_id": "000000000000000000000000"},
        )
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════════════════════════
# GitHub Tests
# ═══════════════════════════════════════════════════════════════════════════════
class TestGitHub:
    async def test_invalid_username(self, client, candidate_token):
        r = await client.post(
            f"{API}/github/analyze",
            headers=auth_headers(candidate_token),
            json={"username": "this-is-definitely-not-a-real-user-xyz999abc"},
        )
        # Either 404 (not found) or 503 (rate limit) — both acceptable
        assert r.status_code in (200, 404, 503)

    async def test_invalid_username_format(self, client, candidate_token):
        r = await client.post(
            f"{API}/github/analyze",
            headers=auth_headers(candidate_token),
            json={"username": "invalid user with spaces"},
        )
        assert r.status_code == 400


# ═══════════════════════════════════════════════════════════════════════════════
# Recruiter Tests
# ═══════════════════════════════════════════════════════════════════════════════
class TestRecruiter:
    async def test_recruiter_rank_requires_role(self, client, candidate_token):
        """Candidate should NOT be able to access recruiter endpoints."""
        r = await client.post(
            f"{API}/recruiter/rank",
            headers=auth_headers(candidate_token),
            json={"job_description_id": "000000000000000000000000"},
        )
        assert r.status_code == 403

    async def test_recruiter_stats_with_role(self, client, recruiter_token):
        r = await client.get(f"{API}/recruiter/stats", headers=auth_headers(recruiter_token))
        assert r.status_code == 200
        assert "total_ats_checks" in r.json()


# ═══════════════════════════════════════════════════════════════════════════════
# Analytics Tests
# ═══════════════════════════════════════════════════════════════════════════════
class TestAnalytics:
    async def test_my_analytics(self, client, candidate_token):
        r = await client.get(f"{API}/analytics/me", headers=auth_headers(candidate_token))
        assert r.status_code == 200
        data = r.json()
        assert "summary" in data
        assert "score_trend" in data
        assert "improvement_tips" in data
        assert "profile_completeness" in data

    async def test_skills_market(self, client, candidate_token):
        r = await client.get(f"{API}/analytics/skills-market", headers=auth_headers(candidate_token))
        assert r.status_code == 200
        assert "skills_in_demand" in r.json()

    async def test_platform_analytics_requires_admin(self, client, candidate_token):
        r = await client.get(f"{API}/analytics/platform", headers=auth_headers(candidate_token))
        assert r.status_code == 403


# ═══════════════════════════════════════════════════════════════════════════════
# NLP Utility Unit Tests
# ═══════════════════════════════════════════════════════════════════════════════
class TestNLPUtils:
    def test_clean_text(self):
        from utils.nlp_utils import clean_text
        result = clean_text("  Hello   WORLD  http://test.com  ")
        assert "http" not in result
        assert "hello" in result

    def test_extract_email(self):
        from utils.nlp_utils import extract_email
        text = "Contact me at john.doe@example.com for more info"
        assert extract_email(text) == "john.doe@example.com"
        assert extract_email("no email here") is None

    def test_extract_phone(self):
        from utils.nlp_utils import extract_phone
        text = "Call me at +1-555-123-4567"
        result = extract_phone(text)
        assert result is not None

    def test_detect_skills(self):
        from utils.nlp_utils import detect_skills_in_text
        text = "Experienced with Python, Docker, React, and AWS cloud services"
        tech, soft = detect_skills_in_text(text)
        assert "python" in tech
        assert "docker" in tech
        assert "react" in tech
        assert "aws" in tech

    def test_extract_keywords(self):
        from utils.nlp_utils import extract_keywords
        text = "Python developer with FastAPI MongoDB Docker experience building REST APIs and microservices"
        keywords = extract_keywords(text, top_n=5)
        assert isinstance(keywords, list)
        assert len(keywords) > 0
        assert all(isinstance(k[0], str) and isinstance(k[1], float) for k in keywords)

    def test_tfidf_similarity_identical(self):
        from utils.nlp_utils import get_tfidf_similarity
        text = "Python FastAPI MongoDB Docker microservices REST API development"
        score = get_tfidf_similarity(text, text)
        assert score == 1.0

    def test_tfidf_similarity_different(self):
        from utils.nlp_utils import get_tfidf_similarity
        score = get_tfidf_similarity("python developer", "graphic designer photoshop")
        assert score < 0.3

    def test_score_to_label(self):
        from utils.validators import score_to_label
        assert score_to_label(0.90) == "strong_match"
        assert score_to_label(0.70) == "good_match"
        assert score_to_label(0.50) == "partial_match"
        assert score_to_label(0.20) == "poor_match"

    def test_score_to_grade(self):
        from utils.validators import score_to_grade
        assert score_to_grade(0.95) == "A+"
        assert score_to_grade(0.85) == "A"
        assert score_to_grade(0.75) == "B"
        assert score_to_grade(0.30) == "F"

    def test_normalize_score_clamp(self):
        from utils.validators import normalize_score
        assert normalize_score(1.5) == 1.0
        assert normalize_score(-0.5) == 0.0
        assert normalize_score(0.75) == 0.75

    def test_extract_sections(self):
        from utils.nlp_utils import extract_sections
        resume_text = """John Doe
Summary
Experienced software engineer with 5 years in Python.
Experience
Software Engineer at Tech Corp
Built REST APIs using FastAPI.
Education
B.S. Computer Science, MIT 2018
Skills
Python Docker AWS React"""
        sections = extract_sections(resume_text)
        assert isinstance(sections, dict)

    def test_extract_years_of_experience(self):
        from utils.nlp_utils import extract_years_of_experience
        text = "I have 7 years of experience in software development"
        assert extract_years_of_experience(text) == 7.0
        text2 = "5+ years of experience working with Python"
        assert extract_years_of_experience(text2) == 5.0


# ═══════════════════════════════════════════════════════════════════════════════
# Security Unit Tests
# ═══════════════════════════════════════════════════════════════════════════════
class TestSecurity:
    def test_password_hash_and_verify(self):
        from core.security import hash_password, verify_password
        pwd = "MySecurePassword123!"
        hashed = hash_password(pwd)
        assert hashed != pwd
        assert verify_password(pwd, hashed)
        assert not verify_password("WrongPassword", hashed)

    def test_access_token_create_and_decode(self):
        from core.security import create_access_token, decode_token
        token = create_access_token("user123")
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "user123"
        assert payload["type"] == "access"

    def test_refresh_token_type(self):
        from core.security import create_refresh_token, decode_token, verify_token_type
        token = create_refresh_token("user456")
        payload = decode_token(token)
        assert verify_token_type(payload, "refresh")
        assert not verify_token_type(payload, "access")

    def test_invalid_token_returns_none(self):
        from core.security import decode_token
        result = decode_token("completely.invalid.token")
        assert result is None

    def test_expired_token(self):
        from datetime import timedelta
        from core.security import create_access_token, decode_token
        token = create_access_token("user789", expires_delta=timedelta(seconds=-1))
        result = decode_token(token)
        assert result is None


# ═══════════════════════════════════════════════════════════════════════════════
# Validator Unit Tests
# ═══════════════════════════════════════════════════════════════════════════════
class TestValidators:
    def test_valid_object_id(self):
        from utils.validators import is_valid_object_id
        assert is_valid_object_id("507f1f77bcf86cd799439011")
        assert not is_valid_object_id("not-an-id")
        assert not is_valid_object_id("")

    def test_github_username_validation(self):
        from utils.validators import is_valid_github_username
        assert is_valid_github_username("torvalds")
        assert is_valid_github_username("my-user-123")
        assert not is_valid_github_username("invalid user")
        assert not is_valid_github_username("-starts-with-dash")

    def test_clamp(self):
        from utils.validators import clamp
        assert clamp(1.5) == 1.0
        assert clamp(-0.5) == 0.0
        assert clamp(0.5) == 0.5

    def test_is_valid_url(self):
        from utils.validators import is_valid_url
        assert is_valid_url("https://google.com")
        assert is_valid_url("http://example.org/path")
        assert not is_valid_url("not-a-url")
