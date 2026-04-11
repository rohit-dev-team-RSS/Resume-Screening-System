# 🚀 AI Career Co-Pilot & Smart ATS Platform

> Enterprise-grade AI backend for intelligent resume analysis, ATS scoring,
> career coaching, and recruiter tools.

---

## 🏗️ Architecture

```
Routes → Services → Repositories → MongoDB
         ↓
     NLP Engine (BERT + TF-IDF)
         ↓
     LLM Provider (Anthropic / OpenAI)
```

**Clean Architecture** — Separation of concerns across every layer:

| Layer | Purpose |
|-------|---------|
| `api/routes/` | HTTP endpoints, request validation, response formatting |
| `services/` | Business logic, AI/NLP processing |
| `repositories/` | MongoDB async CRUD operations |
| `models/` | MongoDB document schemas |
| `schemas/` | Pydantic v2 request/response DTOs |
| `utils/` | Reusable NLP, file, validation helpers |

---

## 📁 Project Structure

```
backend/
├── main.py                    # App factory, middleware, router registration
├── core/
│   ├── config.py              # Pydantic settings (env-driven)
│   ├── security.py            # JWT + password hashing
│   └── logging.py             # Structured logging (structlog)
├── config/
│   └── db.py                  # Motor async MongoDB + index management
├── api/
│   ├── deps.py                # DI: auth guards, repo/service providers
│   └── routes/
│       ├── auth.py            # POST /auth/signup, /login, /refresh, /me
│       ├── resume.py          # POST /resume/upload, GET /resume/{id}
│       ├── ats.py             # POST /ats/match, /bulk-match
│       ├── skills.py          # POST /skills/analyze
│       ├── explain.py         # GET /explain/{result_id}
│       ├── enhance.py         # POST /enhance/resume
│       ├── interview.py       # POST /interview/generate
│       ├── github.py          # POST /github/analyze
│       ├── fake_detect.py     # POST /fake-detect/analyze
│       ├── pdf_gen.py         # POST /pdf/generate
│       ├── recruiter.py       # POST /recruiter/rank
│       ├── analytics.py       # GET /analytics/me, /platform
│       └── health.py          # GET /health
├── services/
│   ├── parser_service.py      # PDF/DOCX text extraction + structuring
│   ├── ats_service.py         # Hybrid BERT + TF-IDF scoring engine
│   ├── skill_service.py       # Gap analysis + learning paths
│   ├── enhancer_service.py    # LLM-powered resume improvement
│   ├── interview_service.py   # Mock interview generation
│   ├── github_service.py      # GitHub profile analysis
│   ├── fake_detection_service.py  # Experience authenticity scoring
│   └── pdf_generator_service.py   # ATS-friendly PDF generation
├── repositories/
│   ├── user_repo.py
│   ├── resume_repo.py
│   └── result_repo.py
├── models/
│   ├── user_model.py
│   ├── resume_model.py
│   └── result_model.py
├── schemas/
│   ├── user_schema.py
│   ├── resume_schema.py
│   └── ats_schema.py
├── utils/
│   ├── nlp_utils.py           # TF-IDF, keyword extraction, skill detection
│   ├── file_utils.py          # Upload validation & storage
│   └── validators.py          # ObjectId, score normalization
├── tests/
│   └── test_api.py            # 50+ test cases
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── nginx.conf
├── requirements.txt
├── pytest.ini
└── .env.example
```

---

## ⚡ Quick Start

### 1. Clone & Setup

```bash
git clone https://github.com/yourorg/ai-career-platform.git
cd ai-career-platform/backend

python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment

```bash
cp .env.example .env
# Edit .env — at minimum set:
# MONGO_URI, SECRET_KEY, GITHUB_TOKEN (optional), ANTHROPIC_API_KEY (optional)
```

### 3. Run

```bash
# Development
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production (4 workers)
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 4. API Docs

| URL | Description |
|-----|-------------|
| http://localhost:8000/docs | Swagger UI (interactive) |
| http://localhost:8000/redoc | ReDoc (clean reference) |
| http://localhost:8000/health | Health check |
| http://localhost:8000/metrics | Prometheus metrics |

---

## 🐳 Docker Deployment

```bash
cd docker/

# Build and start all services
docker compose up -d --build

# Dev mode (includes Mongo Express UI at :8081)
docker compose --profile dev up -d

# Scale API workers
docker compose up -d --scale api=3

# View logs
docker compose logs -f api

# Stop
docker compose down
```

**Services started:**
- `api` → FastAPI at `:8000`
- `mongo` → MongoDB at `:27017`
- `redis` → Redis at `:6379`
- `nginx` → Reverse proxy at `:80`
- `celery_worker` → Background tasks
- `mongo_express` → MongoDB UI at `:8081` (dev only)

---

## 🌐 Complete API Reference

### 🔐 Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/signup` | Register new user |
| POST | `/api/v1/auth/login` | Login → JWT tokens |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET | `/api/v1/auth/me` | Get current user |
| PUT | `/api/v1/auth/me` | Update profile |
| POST | `/api/v1/auth/change-password` | Change password |
| DELETE | `/api/v1/auth/me` | Deactivate account |

### 📄 Resume
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/resume/upload` | Upload PDF/DOCX (async parse) |
| GET | `/api/v1/resume/` | List user's resumes |
| GET | `/api/v1/resume/{id}` | Get resume details |
| PUT | `/api/v1/resume/{id}` | Update tags/primary |
| POST | `/api/v1/resume/{id}/reparse` | Re-trigger parsing |
| DELETE | `/api/v1/resume/{id}` | Delete resume |

### 🎯 ATS Engine
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/ats/match` | Single resume scoring |
| POST | `/api/v1/ats/bulk-match` | Batch scoring (up to 50) |
| GET | `/api/v1/ats/history` | Scoring history |
| GET | `/api/v1/ats/result/{id}` | Full result detail |

### 🧠 AI Features
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/skills/analyze` | Skill gap + learning path |
| GET | `/api/v1/skills/market-demand` | Market skill demand scores |
| GET | `/api/v1/explain/{result_id}` | XAI score breakdown |
| GET | `/api/v1/explain/compare-models/{id}` | BERT vs TF-IDF comparison |
| POST | `/api/v1/enhance/resume` | LLM resume enhancement |
| POST | `/api/v1/interview/generate` | Mock interview questions |
| POST | `/api/v1/github/analyze` | GitHub profile analysis |
| GET | `/api/v1/github/profile/{username}` | Quick GitHub profile |
| POST | `/api/v1/fake-detect/analyze` | Experience authenticity |
| POST | `/api/v1/pdf/generate` | Generate ATS-friendly PDF |
| GET | `/api/v1/pdf/download/{user_id}/{file}` | Download PDF |

### 👔 Recruiter
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/recruiter/rank` | Rank candidates for JD |
| GET | `/api/v1/recruiter/pipeline` | View hiring pipeline |
| GET | `/api/v1/recruiter/stats` | Recruiter dashboard stats |

### 📊 Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/analytics/me` | Personal analytics |
| GET | `/api/v1/analytics/platform` | Platform-wide (Admin) |
| GET | `/api/v1/analytics/skills-market` | Skill demand trends |

---

## 🧠 ATS Scoring Formula

```
final_score = 0.6 × BERT_similarity + 0.4 × TF-IDF_similarity
```

**Component Breakdown:**
- **BERT Semantic Similarity** (60%) — Contextual meaning via `all-MiniLM-L6-v2`
- **TF-IDF Keyword Match** (40%) — Literal keyword overlap
- **Experience Score** — Years vs. requirements
- **Education Score** — Degree level vs. JD requirements
- **Skills Coverage** — Required/preferred skills match rate

**Grade Scale:**
| Score | Grade | Recommendation |
|-------|-------|----------------|
| ≥ 80% | A/A+ | Strong Match |
| 65–79% | B | Good Match |
| 45–64% | C/D | Partial Match |
| < 45% | F | Poor Match |

---

## 🧪 Testing

```bash
# Run all tests
pytest tests/ -v

# Run specific class
pytest tests/test_api.py::TestAuth -v

# With coverage
pip install pytest-cov
pytest tests/ --cov=. --cov-report=html

# Unit tests only
pytest tests/ -v -m unit
```

---

## 🚀 Production Deployment

### Render.com
```bash
# render.yaml (create in root)
services:
  - type: web
    name: ai-career-api
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2
    envVars:
      - key: MONGO_URI
        sync: false
      - key: SECRET_KEY
        generateValue: true
```

### AWS ECS / Fargate
```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker build -f docker/Dockerfile -t ai-career-api .
docker tag ai-career-api:latest <account>.dkr.ecr.us-east-1.amazonaws.com/ai-career-api:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/ai-career-api:latest
```

### Environment Variables for Production
```bash
SECRET_KEY=$(openssl rand -hex 32)
DEBUG=false
ENVIRONMENT=production
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/
SENTRY_DSN=https://...@sentry.io/...
```

---

## ⚙️ Performance Tips

1. **BERT Model** — Loads once at startup via singleton. First request is slow (~2s). Subsequent: ~50ms.
2. **Bulk Scoring** — Uses batched BERT embeddings for O(1) extra API calls regardless of resume count.
3. **MongoDB Indexes** — All collections indexed on creation via `_ensure_indexes()`.
4. **Async Everywhere** — No blocking I/O — all DB calls, HTTP calls, and file I/O are async.
5. **Background Parsing** — Resume upload returns immediately; parsing runs in background.
6. **GZip Middleware** — Responses >1KB compressed automatically.
7. **Connection Pooling** — MongoDB pool: 10–100 connections.
8. **Redis Caching** — Add `aiocache` decorators to hot endpoints for 10x speedup.

---

## 📦 Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| fastapi | 0.111 | Async web framework |
| motor | 3.4 | Async MongoDB driver |
| pydantic | 2.7 | Data validation |
| sentence-transformers | 2.7 | BERT embeddings |
| scikit-learn | 1.4 | TF-IDF + cosine similarity |
| pdfplumber | 0.11 | PDF text extraction |
| python-docx | 1.1 | DOCX text extraction |
| reportlab | 4.1 | PDF generation |
| python-jose | 3.3 | JWT tokens |
| passlib | 1.7 | Bcrypt password hashing |
| structlog | 24.1 | Structured logging |
| httpx | 0.27 | Async HTTP client (GitHub, LLM APIs) |

---

## 🛡️ Security

- **JWT** with short-lived access tokens (60 min) + long-lived refresh tokens (30 days)
- **bcrypt** password hashing with salting
- **Role-based access control** (candidate / recruiter / admin)
- **File validation** — MIME type + size checks before saving
- **Input validation** — Pydantic v2 on every request
- **Path traversal prevention** on file downloads
- **Non-root Docker user** in production image
- **Rate limiting ready** — middleware slot available for SlowAPI

---

*Built with ❤️ | Production-ready | Clean Architecture | Scalable*