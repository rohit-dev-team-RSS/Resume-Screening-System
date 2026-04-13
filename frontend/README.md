# AI Career Co-Pilot — Frontend

> Production-grade React + Tailwind dashboard for the AI Career Co-Pilot & Smart ATS Platform.

## Design System
- **Theme**: Clean ivory-white light theme with indigo primary
- **Fonts**: Playfair Display (headings) + Plus Jakarta Sans (body) + JetBrains Mono (code)
- **Colors**: #FAF9F6 cream base · #6366F1 indigo · #10B981 emerald · #F59E0B amber
- **Animations**: framer-motion page transitions, ScoreRing SVG animation, AnimatedBar progress fills

## Quick Start

```bash
npm install
cp .env.local.example .env.local
npm run dev
# → http://localhost:5173
```

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard` | Dashboard | Stats, activity, quick actions |
| `/upload` | Upload | Resume uploader with drag & drop |
| `/results` | ATS Matcher | BERT+TF-IDF scoring with full breakdown |
| `/analytics` | Analytics | Charts, trends, market demand |
| `/interview` | Interview | Mock interview question generator |
| `/enhance` | Enhance | LLM resume improvement |
| `/github` | GitHub | Profile & tech stack analysis |
| `/fake-detect` | Authenticity | 7-factor fake experience detector |

## Components

- `ScoreRing` — SVG animated circular score gauge
- `ATSResult` — Full ATS score breakdown display
- `Charts` — Recharts wrappers (trend, radar, bar, pie)
- `ResumeUpload` — Dropzone with progress animation
- `SkillAnalysis` — Skill gap + learning path display
- `Sidebar` + `Navbar` + `AppLayout` — Shell layout

