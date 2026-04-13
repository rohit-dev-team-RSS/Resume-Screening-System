"""
GitHub Analyzer Service — Fetch repos, analyze tech stack, contribution metrics
"""

from typing import Dict, List, Optional

import httpx
import structlog

from core.config import settings

logger = structlog.get_logger(__name__)


class GitHubService:

    def __init__(self):
        self.base_url = settings.GITHUB_API_BASE
        self.headers = {"Accept": "application/vnd.github+json"}
        if settings.GITHUB_TOKEN:
            self.headers["Authorization"] = f"Bearer {settings.GITHUB_TOKEN}"

    async def analyze_profile(self, username: str) -> dict:
        async with httpx.AsyncClient(timeout=20.0) as client:
            user_data = await self._fetch_user(client, username)
            repos = await self._fetch_repos(client, username)
            languages = self._aggregate_languages(repos)
            top_repos = self._get_top_repos(repos)
            contribution_score = self._compute_contribution_score(user_data, repos)
            tech_stack = self._derive_tech_stack(languages)
            insights = self._generate_insights(user_data, repos, languages)

            return {
                "username": username,
                "profile": {
                    "name": user_data.get("name"),
                    "bio": user_data.get("bio"),
                    "location": user_data.get("location"),
                    "company": user_data.get("company"),
                    "blog": user_data.get("blog"),
                    "public_repos": user_data.get("public_repos", 0),
                    "followers": user_data.get("followers", 0),
                    "following": user_data.get("following", 0),
                    "account_age_years": self._account_age(user_data.get("created_at", "")),
                    "avatar_url": user_data.get("avatar_url"),
                    "github_url": user_data.get("html_url"),
                },
                "languages": languages,
                "tech_stack": tech_stack,
                "top_repositories": top_repos,
                "contribution_score": contribution_score,
                "activity_level": self._compute_activity_level(user_data, repos),
                "insights": insights,
                "open_source_contributions": user_data.get("public_gists", 0),
                "hirability_signals": self._hirability_signals(user_data, repos, languages),
            }

    async def _fetch_user(self, client: httpx.AsyncClient, username: str) -> dict:
        resp = await client.get(f"{self.base_url}/users/{username}", headers=self.headers)
        if resp.status_code == 404:
            raise ValueError(f"GitHub user '{username}' not found.")
        if resp.status_code == 403:
            raise RuntimeError("GitHub API rate limit exceeded. Set GITHUB_TOKEN in config.")
        resp.raise_for_status()
        return resp.json()

    async def _fetch_repos(self, client: httpx.AsyncClient, username: str) -> List[dict]:
        all_repos = []
        page = 1
        while page <= 3:  # Max 3 pages (300 repos)
            resp = await client.get(
                f"{self.base_url}/users/{username}/repos",
                headers=self.headers,
                params={"per_page": 100, "page": page, "sort": "pushed", "type": "owner"},
            )
            if resp.status_code != 200:
                break
            repos = resp.json()
            if not repos:
                break
            all_repos.extend(repos)
            page += 1
        return all_repos

    def _aggregate_languages(self, repos: List[dict]) -> Dict[str, int]:
        lang_count: Dict[str, int] = {}
        for repo in repos:
            lang = repo.get("language")
            if lang:
                lang_count[lang] = lang_count.get(lang, 0) + 1
        return dict(sorted(lang_count.items(), key=lambda x: x[1], reverse=True))

    def _get_top_repos(self, repos: List[dict]) -> List[dict]:
        sorted_repos = sorted(repos, key=lambda r: r.get("stargazers_count", 0), reverse=True)
        return [
            {
                "name": r["name"],
                "description": r.get("description", ""),
                "language": r.get("language"),
                "stars": r.get("stargazers_count", 0),
                "forks": r.get("forks_count", 0),
                "url": r.get("html_url"),
                "topics": r.get("topics", []),
                "updated_at": r.get("pushed_at"),
            }
            for r in sorted_repos[:10]
        ]

    def _compute_contribution_score(self, user: dict, repos: List[dict]) -> float:
        score = 0.0
        repos_count = min(user.get("public_repos", 0), 50)
        followers = min(user.get("followers", 0), 200)
        total_stars = sum(r.get("stargazers_count", 0) for r in repos)
        forks = sum(r.get("forks_count", 0) for r in repos)

        score += repos_count / 50 * 0.25
        score += followers / 200 * 0.20
        score += min(total_stars / 100, 1.0) * 0.35
        score += min(forks / 50, 1.0) * 0.20
        return round(min(score, 1.0), 3)

    def _compute_activity_level(self, user: dict, repos: List[dict]) -> str:
        total_repos = user.get("public_repos", 0)
        if total_repos >= 30:
            return "very_active"
        elif total_repos >= 15:
            return "active"
        elif total_repos >= 5:
            return "moderate"
        else:
            return "low"

    def _derive_tech_stack(self, languages: Dict[str, int]) -> List[str]:
        return list(languages.keys())[:10]

    def _account_age(self, created_at: str) -> float:
        if not created_at:
            return 0.0
        from datetime import datetime, timezone
        try:
            created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            delta = datetime.now(timezone.utc) - created
            return round(delta.days / 365.25, 1)
        except Exception:
            return 0.0

    def _generate_insights(self, user: dict, repos: List[dict], languages: Dict[str, int]) -> List[str]:
        insights = []
        top_lang = list(languages.keys())[0] if languages else None
        if top_lang:
            insights.append(f"Primary language is {top_lang} with {languages[top_lang]} repositories.")
        total_stars = sum(r.get("stargazers_count", 0) for r in repos)
        if total_stars > 50:
            insights.append(f"Portfolio has earned {total_stars} total GitHub stars — strong community recognition.")
        if user.get("public_repos", 0) > 20:
            insights.append(f"Active contributor with {user['public_repos']} public repositories.")
        if user.get("followers", 0) > 100:
            insights.append(f"Influential developer with {user['followers']} GitHub followers.")
        if len(languages) > 5:
            insights.append(f"Polyglot developer proficient in {len(languages)} languages.")
        return insights or ["Limited public activity — encourage building a stronger GitHub presence."]

    def _hirability_signals(self, user: dict, repos: List[dict], languages: dict) -> dict:
        total_stars = sum(r.get("stargazers_count", 0) for r in repos)
        return {
            "has_readme": any(r.get("description") for r in repos[:10]),
            "active_recently": any(r.get("pushed_at", "")[:4] == "2024" for r in repos),
            "multiple_languages": len(languages) > 3,
            "popular_projects": total_stars > 20,
            "collaboration_indicator": sum(r.get("forks_count", 0) for r in repos) > 5,
            "open_source_score": round(min(total_stars / 50, 1.0), 2),
        }
