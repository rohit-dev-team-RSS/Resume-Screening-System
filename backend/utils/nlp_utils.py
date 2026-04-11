"""
NLP Utilities — text cleaning, keyword extraction, skill detection
"""

import re
import string
from typing import List, Set, Tuple

import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize, sent_tokenize
from sklearn.feature_extraction.text import TfidfVectorizer

# Download NLTK data (run once)
_nltk_downloads = ["punkt", "stopwords", "wordnet", "averaged_perceptron_tagger"]
for pkg in _nltk_downloads:
    try:
        nltk.download(pkg, quiet=True)
    except Exception:
        pass

_lemmatizer = WordNetLemmatizer()
_stop_words = set(stopwords.words("english"))

# ─── Known Skill Lists ────────────────────────────────────────────────────────
TECH_SKILLS = {
    # Languages
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust",
    "kotlin", "swift", "scala", "ruby", "php", "r", "matlab", "sql", "bash",
    # Web
    "react", "vue", "angular", "nextjs", "nuxt", "svelte", "html", "css",
    "tailwind", "bootstrap", "jquery", "webpack", "vite",
    # Backend
    "fastapi", "django", "flask", "express", "nestjs", "spring", "rails",
    "graphql", "rest", "grpc", "websocket",
    # Data/AI
    "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch", "keras",
    "huggingface", "langchain", "spark", "hadoop", "kafka",
    # Cloud
    "aws", "gcp", "azure", "docker", "kubernetes", "terraform", "ansible",
    "jenkins", "github actions", "ci/cd",
    # Databases
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "cassandra",
    "dynamodb", "neo4j", "sqlite",
    # Tools
    "git", "linux", "jira", "confluence", "figma", "postman",
}

SOFT_SKILLS = {
    "communication", "leadership", "teamwork", "problem solving", "critical thinking",
    "creativity", "adaptability", "time management", "collaboration", "mentoring",
    "presentation", "negotiation", "project management", "agile", "scrum",
}


def clean_text(text: str, remove_stopwords: bool = False) -> str:
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r"http\S+|www\S+", "", text)
    text = re.sub(r"[^\w\s\-\+\#\.]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if remove_stopwords:
        tokens = word_tokenize(text)
        tokens = [t for t in tokens if t not in _stop_words and len(t) > 1]
        return " ".join(tokens)
    return text


def lemmatize_text(text: str) -> str:
    tokens = word_tokenize(text)
    return " ".join(_lemmatizer.lemmatize(t) for t in tokens)


def extract_keywords(
    text: str,
    top_n: int = 30,
    min_df: int = 1,
) -> List[Tuple[str, float]]:
    """Extract top-n keywords using TF-IDF from a single document."""
    cleaned = clean_text(text, remove_stopwords=True)
    if not cleaned:
        return []
    try:
        vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=200,
            min_df=min_df,
            stop_words="english",
        )
        tfidf_matrix = vectorizer.fit_transform([cleaned])
        scores = zip(vectorizer.get_feature_names_out(), tfidf_matrix.toarray()[0])
        sorted_scores = sorted(scores, key=lambda x: x[1], reverse=True)
        return [(word, round(score, 4)) for word, score in sorted_scores[:top_n] if score > 0]
    except Exception:
        return []


def detect_skills_in_text(text: str) -> Tuple[List[str], List[str]]:
    """Returns (technical_skills, soft_skills) found in text."""
    lowered = text.lower()
    tech = sorted([s for s in TECH_SKILLS if re.search(rf"\b{re.escape(s)}\b", lowered)])
    soft = sorted([s for s in SOFT_SKILLS if re.search(rf"\b{re.escape(s)}\b", lowered)])
    return tech, soft


def extract_email(text: str) -> str | None:
    match = re.search(r"[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}", text)
    return match.group(0) if match else None


def extract_phone(text: str) -> str | None:
    match = re.search(r"(\+?\d[\d\s\-().]{7,18}\d)", text)
    return match.group(0).strip() if match else None


def extract_urls(text: str) -> List[str]:
    pattern = r"https?://[^\s<>\"]+|www\.[^\s<>\"]+|linkedin\.com/in/[^\s<>\"]+|github\.com/[^\s<>\"]*"
    return re.findall(pattern, text, re.IGNORECASE)


def count_words(text: str) -> int:
    return len(text.split()) if text else 0


def extract_years_of_experience(text: str) -> float:
    """
    Parse total years of experience from resume text.
    Looks for patterns like '5 years', '3+ years', etc.
    """
    patterns = [
        r"(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp)",
        r"experience\s*(?:of\s*)?(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)",
    ]
    max_years = 0.0
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            try:
                years = float(match.group(1))
                max_years = max(max_years, years)
            except ValueError:
                pass
    return max_years


def get_tfidf_similarity(text1: str, text2: str) -> float:
    """Compute cosine TF-IDF similarity between two texts."""
    from sklearn.metrics.pairwise import cosine_similarity
    try:
        texts = [clean_text(text1, remove_stopwords=True), clean_text(text2, remove_stopwords=True)]
        vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words="english")
        matrix = vectorizer.fit_transform(texts)
        sim = cosine_similarity(matrix[0:1], matrix[1:2])[0][0]
        return round(float(sim), 4)
    except Exception:
        return 0.0


def extract_sections(text: str) -> dict:
    """Split resume text into sections by common headers."""
    section_headers = {
        "summary": r"(summary|objective|profile|about)",
        "experience": r"(experience|employment|work history|career)",
        "education": r"(education|academic|qualification)",
        "skills": r"(skills|technical skills|competencies|expertise)",
        "projects": r"(projects|portfolio)",
        "certifications": r"(certifications?|licenses?|courses?)",
    }
    sections = {}
    lines = text.split("\n")
    current_section = "header"
    buffer = []

    for line in lines:
        line_stripped = line.strip()
        matched_section = None
        for section, pattern in section_headers.items():
            if re.match(pattern, line_stripped, re.IGNORECASE) and len(line_stripped) < 50:
                matched_section = section
                break
        if matched_section:
            if buffer:
                sections[current_section] = "\n".join(buffer).strip()
            current_section = matched_section
            buffer = []
        else:
            buffer.append(line)

    if buffer:
        sections[current_section] = "\n".join(buffer).strip()

    return sections
