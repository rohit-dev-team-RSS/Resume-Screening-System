# 🚀 AI Resume Screening System (CareerAI)

An advanced **AI-powered Resume Screening & Career Intelligence Platform** that evaluates resumes against job descriptions using **NLP, Machine Learning, and LLMs**.

---

## 🌟 Features

### 🔍 Smart ATS Scoring
- TF-IDF + BERT hybrid scoring engine
- Resume vs Job Description matching
- ATS score with accuracy insights

### 🤖 AI Resume Enhancer
- LLM-powered improvements
- Keyword optimization
- ATS-friendly suggestions

### 📊 Skill Gap Analysis
- Identify missing skills
- Suggest learning paths
- Industry trend insights

### 🎤 AI Interview System
- AI-generated interview questions
- Real-time feedback
- Performance analytics

### 📄 Resume Processing
- PDF/DOCX parsing
- Structured data extraction

### 📈 Analytics Dashboard
- Resume performance tracking
- Career insights visualization

---

## 🏗️ Tech Stack

### 🔹 Frontend
- React (Vite)
- Tailwind CSS
- Axios

### 🔹 Backend
- FastAPI
- Python
- JWT Authentication
- Argon2 Password Hashing

### 🔹 AI / ML
- Scikit-learn
- Sentence Transformers
- NLP (NLTK, spaCy)

### 🔹 Database
- MongoDB Atlas

### 🔹 Deployment
- Frontend → Vercel
- Backend → Render

---

## 📂 Project Structure
Resume-Screening-System/
│
├── backend/ # FastAPI backend
├── frontend/ # React frontend
├── documentation/ # Project docs
├── requirements.txt # Python dependencies
├── render.yaml # Deployment config
└── README.md


---

## ⚙️ Installation & Setup

### 🔹 1. Clone the Repository

```bash
git clone https://github.com/agrawalrohit937/Resume-Screening-System.git
cd Resume-Screening-System

🔹 2. Backend Setup
cd backend
python -m venv venv
source venv/bin/activate  # (Windows: venv\Scripts\activate)

pip install -r requirements.txt

🔹 3. Environment Variables

Create .env in backend:

MONGO_URI=your_mongodb_uri
SECRET_KEY=your_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
DEBUG=True

🔹 4. Run Backend
uvicorn main:app --reload

👉 Backend runs on:

http://localhost:8000

🔹 5. Frontend Setup
cd frontend
npm install

🔹 6. Frontend Environment

Create .env in frontend:

VITE_API_URL=http://localhost:8000/api/v1

🔹 7. Run Frontend

npm run dev

👉 Frontend runs on:

http://localhost:5173
🌐 Live Deployment
🔹 Frontend (Vercel)

👉 https://resume-screening-system-lyart.vercel.app

🔹 Backend (Render)

👉 https://resume-screening-system-hb2d.onrender.com

🔹 API Docs

👉 https://resume-screening-system-hb2d.onrender.com/docs

🔐 Authentication
JWT-based authentication
Secure password hashing using Argon2
Token-based session handling
📡 API Endpoints
🔹 Auth
POST /api/v1/auth/signup
POST /api/v1/auth/login
🔹 Resume
POST /api/v1/resume/upload
🔹 ATS
POST /api/v1/ats/score
🔹 Interview
POST /api/v1/interview/generate
🧪 Testing

Use Swagger UI:

/docs

Or use tools like:

Postman
Curl