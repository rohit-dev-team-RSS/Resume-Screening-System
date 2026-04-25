/**
 * Results.jsx — Unified ATS + AI Enhancer workflow
 * Single-page flow: Upload Resume → Paste/Upload JD → Analyze → See Results → Enhance → Download PDF
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext';
import {
  uploadResume, getResumes, matchATS, enhanceResume, generatePDF,
} from '../services/api'
import ScoreRing from '../components/ScoreRing'
import { AnimatedBar } from '../components/AnimatedNumber'
import api from '../services/api'
// ── Tutorial links for skill gaps ─────────────────────────────────────────────
const TUTORIAL_MAP = {
  kubernetes:   [{ title:'Kubernetes Official Docs', url:'https://kubernetes.io/docs/tutorials/' }, { title:'KodeKloud K8s Course (Free)', url:'https://kodekloud.com/courses/kubernetes-for-the-absolute-beginners-hands-on/' }],
  terraform:    [{ title:'HashiCorp Learn Terraform', url:'https://developer.hashicorp.com/terraform/tutorials' }, { title:'Terraform on AWS – Free', url:'https://www.youtube.com/watch?v=SLB_c_ayRMo' }],
  docker:       [{ title:'Docker Official Getting Started', url:'https://docs.docker.com/get-started/' }, { title:'Docker for Beginners – freeCodeCamp', url:'https://www.youtube.com/watch?v=fqMOX6JJhGo' }],
  python:       [{ title:'Python Official Tutorial', url:'https://docs.python.org/3/tutorial/' }, { title:'Python Full Course – freeCodeCamp', url:'https://www.youtube.com/watch?v=rfscVS0vtbw' }],
  aws:          [{ title:'AWS Free Training', url:'https://aws.amazon.com/training/digital/' }, { title:'AWS Cloud Practitioner Free', url:'https://www.youtube.com/watch?v=SOTamWNgDKc' }],
  react:        [{ title:'React Official Docs', url:'https://react.dev/learn' }, { title:'React Full Course – freeCodeCamp', url:'https://www.youtube.com/watch?v=bMknfKXIFA8' }],
  graphql:      [{ title:'GraphQL Official Tutorial', url:'https://graphql.org/learn/' }, { title:'GraphQL Crash Course', url:'https://www.youtube.com/watch?v=ed8SzALpx1Q' }],
  rust:         [{ title:'The Rust Book (Free)', url:'https://doc.rust-lang.org/book/' }, { title:'Rust Crash Course', url:'https://www.youtube.com/watch?v=zF34dRivLOw' }],
  kafka:        [{ title:'Apache Kafka Docs', url:'https://kafka.apache.org/documentation/' }, { title:'Kafka Basics – Confluent', url:'https://developer.confluent.io/courses/apache-kafka/events/' }],
  postgresql:   [{ title:'PostgreSQL Tutorial', url:'https://www.postgresqltutorial.com/' }, { title:'SQL Full Course – freeCodeCamp', url:'https://www.youtube.com/watch?v=qw--VYLpxG4' }],
  mongodb:      [{ title:'MongoDB University (Free)', url:'https://learn.mongodb.com/' }, { title:'MongoDB Crash Course', url:'https://www.youtube.com/watch?v=ofme2o29ngU' }],
  typescript:   [{ title:'TypeScript Handbook', url:'https://www.typescriptlang.org/docs/handbook/intro.html' }, { title:'TypeScript Full Course', url:'https://www.youtube.com/watch?v=30LWjhZzg50' }],
  'ci/cd':      [{ title:'GitHub Actions Docs', url:'https://docs.github.com/en/actions' }, { title:'CI/CD Explained', url:'https://www.youtube.com/watch?v=scEDHsr3APg' }],
  microservices:[{ title:'Microservices Pattern Book', url:'https://microservices.io/patterns/index.html' }, { title:'Microservices Full Course', url:'https://www.youtube.com/watch?v=lTAcCNbJ7KE' }],
}

function getTutorials(skill) {
  const key = skill.toLowerCase()
  return TUTORIAL_MAP[key] || [
    { title:`Search "${skill}" on freeCodeCamp`, url:`https://www.freecodecamp.org/news/search/?query=${encodeURIComponent(skill)}` },
    { title:`"${skill}" on YouTube`, url:`https://www.youtube.com/results?search_query=${encodeURIComponent(skill + ' tutorial')}` },
  ]
}

// ── Score color helper ─────────────────────────────────────────────────────────
function scoreColor(pct) {
  if (pct >= 80) return '#10B981'
  if (pct >= 60) return '#6366F1'
  if (pct >= 40) return '#F59E0B'
  return '#F43F5E'
}
function scoreBg(pct) {
  if (pct >= 80) return { bg:'#ECFDF5', border:'#A7F3D0', text:'#065F46' }
  if (pct >= 60) return { bg:'#EFF6FF', border:'#BFDBFE', text:'#1E40AF' }
  if (pct >= 40) return { bg:'#FFFBEB', border:'#FDE68A', text:'#92400E' }
  return { bg:'#FFF1F2', border:'#FECDD3', text:'#881337' }
}

// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

// ── Chip ─────────────────────────────────────────────────────────────────────
function Chip({ word, matched }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4, padding:'4px 10px',
      borderRadius:8, fontSize:12, fontFamily:"'JetBrains Mono',monospace", fontWeight:500,
      margin:3, border:'1px solid',
      ...(matched
        ? { background:'#ECFDF5', borderColor:'#A7F3D0', color:'#065F46' }
        : { background:'#FFF1F2', borderColor:'#FECDD3', color:'#9F1239', textDecoration:'line-through', opacity:0.7 }
      ),
    }}>
      {matched ? '✓' : '✕'} {word}
    </span>
  )
}

// ── Keywords Tab ──────────────────────────────────────────────────────────────
function KeywordsTab({ result }) {
  const matched = result?.keyword_analysis?.matched_keywords || result?.matched_skills || []
  const missing = result?.keyword_analysis?.missing_keywords || result?.missing_skills || []
  const rate    = Math.round((result?.keyword_analysis?.keyword_match_rate || 0) * 100)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Match rate bar */}
      <div style={{ padding:'16px 20px', borderRadius:16, background:'#F8FAFC', border:'1px solid #E2E8F0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
          <span style={{ fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:600, color:'#475569' }}>Keyword Match Rate</span>
          <span style={{ fontFamily:"'Sora',sans-serif", fontSize:16, fontWeight:800, color: scoreColor(rate) }}>{rate}%</span>
        </div>
        <AnimatedBar value={rate} color={scoreColor(rate)} height={10}/>
        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#94A3B8', marginTop:8 }}>
          {matched.length} matched · {missing.length} missing from your resume
        </p>
      </div>

      {/* Matched keywords */}
      {matched.length > 0 && (
        <div style={{ padding:'16px 20px', borderRadius:16, background:'#F0FDF4', border:'1px solid #BBF7D0' }}>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, color:'#15803D', marginBottom:10,
            textTransform:'uppercase', letterSpacing:'0.06em' }}>
            ✓ Found in Your Resume ({matched.length})
          </p>
          <div style={{ display:'flex', flexWrap:'wrap' }}>
            {matched.slice(0,30).map(k => <Chip key={k} word={k} matched/>)}
          </div>
        </div>
      )}

      {/* Missing keywords */}
      {missing.length > 0 && (
        <div style={{ padding:'16px 20px', borderRadius:16, background:'#FFF1F2', border:'1px solid #FECDD3' }}>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, color:'#9F1239', marginBottom:10,
            textTransform:'uppercase', letterSpacing:'0.06em' }}>
            ✕ Missing from Your Resume ({missing.length})
          </p>
          <div style={{ display:'flex', flexWrap:'wrap' }}>
            {missing.slice(0,30).map(k => <Chip key={k} word={k} matched={false}/>)}
          </div>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#9F1239', marginTop:12, opacity:0.8 }}>
            💡 Add these keywords naturally in your experience bullets to improve your score.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Skills Tab ────────────────────────────────────────────────────────────────
function SkillsTab({ result }) {
  const matched = result?.matched_skills || []
  const missing = result?.missing_skills || []
  const gaps    = result?.skill_gaps || []

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        {/* Matched */}
        <div style={{ padding:'16px 18px', borderRadius:16, background:'#F0FDF4', border:'1px solid #BBF7D0' }}>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, color:'#15803D', marginBottom:12,
            textTransform:'uppercase', letterSpacing:'0.06em' }}>✓ You Have</p>
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {matched.slice(0,12).map(s => (
              <div key={s} style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:18, height:18, borderRadius:'50%', background:'#DCFCE7', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:9, color:'#15803D', fontWeight:700 }}>✓</span>
                </div>
                <span style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'#166534', textTransform:'capitalize' }}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Missing */}
        <div style={{ padding:'16px 18px', borderRadius:16, background:'#FFF1F2', border:'1px solid #FECDD3' }}>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, color:'#9F1239', marginBottom:12,
            textTransform:'uppercase', letterSpacing:'0.06em' }}>○ You Need</p>
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {missing.slice(0,12).map(s => (
              <div key={s} style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:18, height:18, borderRadius:'50%', background:'#FFE4E6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:9, color:'#9F1239' }}>○</span>
                </div>
                <span style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'#9F1239', textTransform:'capitalize' }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Skill gaps with importance */}
      {gaps.length > 0 && (
        <div>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:700, color:'#1E293B', marginBottom:12 }}>
            Skill Gap Analysis
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:10 }}>
            {gaps.slice(0,9).map((g, i) => {
              const impCfg = {
                critical:     { bg:'#FFF1F2', border:'#FECDD3', text:'#9F1239', badge:'Critical' },
                important:    { bg:'#FFFBEB', border:'#FDE68A', text:'#92400E', badge:'Important' },
                nice_to_have: { bg:'#F8FAFC', border:'#E2E8F0', text:'#475569', badge:'Nice to have' },
              }[g.importance] || { bg:'#F8FAFC', border:'#E2E8F0', text:'#475569', badge:'Optional' }
              return (
                <div key={i} style={{ padding:'12px 14px', borderRadius:14, background:impCfg.bg, border:`1px solid ${impCfg.border}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:5 }}>
                    <span style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:13, color:'#1E293B', textTransform:'capitalize' }}>{g.skill}</span>
                    <span style={{ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:20,
                      background:`${impCfg.text}18`, color:impCfg.text, fontFamily:"'Inter',sans-serif",
                      whiteSpace:'nowrap', marginLeft:4 }}>{impCfg.badge}</span>
                  </div>
                  {g.estimated_learning_weeks && (
                    <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#94A3B8' }}>
                      ⏱ ~{g.estimated_learning_weeks}w to learn
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Roadmap Tab ────────────────────────────────────────────────────────────────
function RoadmapTab({ result }) {
  const strengths    = result?.strengths || []
  const weaknesses   = result?.weaknesses || []
  const suggestions  = result?.improvement_suggestions || []
  const missing      = result?.missing_skills || []
  const gaps         = result?.skill_gaps || []

  // skills to show tutorials for: skill_gaps + top missing
  const skillsToLearn = [
    ...gaps.map(g => g.skill),
    ...missing.slice(0, 6),
  ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 8)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {/* Strengths / Weaknesses */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <div style={{ padding:'16px 18px', borderRadius:16, background:'#F0FDF4', border:'1px solid #BBF7D0' }}>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, color:'#15803D', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.06em' }}>
            💪 Your Strengths
          </p>
          {strengths.slice(0,4).map((s, i) => (
            <div key={i} style={{ display:'flex', gap:8, marginBottom:8, fontFamily:"'Inter',sans-serif", fontSize:13, color:'#166534', alignItems:'flex-start' }}>
              <span style={{ color:'#10B981', flexShrink:0, marginTop:1 }}>✓</span>{s}
            </div>
          ))}
          {strengths.length === 0 && <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'#94A3B8' }}>Run analysis to see strengths</p>}
        </div>

        <div style={{ padding:'16px 18px', borderRadius:16, background:'#FFF1F2', border:'1px solid #FECDD3' }}>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, color:'#9F1239', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.06em' }}>
            🎯 Areas to Improve
          </p>
          {weaknesses.slice(0,4).map((w, i) => (
            <div key={i} style={{ display:'flex', gap:8, marginBottom:8, fontFamily:"'Inter',sans-serif", fontSize:13, color:'#9F1239', alignItems:'flex-start' }}>
              <span style={{ flexShrink:0, marginTop:1 }}>→</span>{w}
            </div>
          ))}
          {weaknesses.length === 0 && <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'#94A3B8' }}>Run analysis to see areas</p>}
        </div>
      </div>

      {/* Improvement steps */}
      {suggestions.length > 0 && (
        <div>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:700, color:'#1E293B', marginBottom:12 }}>
            📋 Improvement Action Plan
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {suggestions.map((s, i) => (
              <motion.div key={i} initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.07 }}
                style={{ display:'flex', gap:14, padding:'12px 16px', background:'#F8FAFC', borderRadius:12, border:'1px solid #E2E8F0' }}>
                <div style={{ width:26, height:26, borderRadius:8, background:'#EFF6FF', border:'1px solid #BFDBFE',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:700, color:'#3730A3' }}>
                    {String(i+1).padStart(2,'0')}
                  </span>
                </div>
                <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'#374151', lineHeight:1.65, flex:1 }}>{s}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Learning resources */}
      {skillsToLearn.length > 0 && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
            <div style={{ width:24, height:24, borderRadius:8, background:'#FFFBEB', border:'1px solid #FDE68A',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontSize:12 }}>🎓</span>
            </div>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:700, color:'#1E293B' }}>
              Free Learning Resources
            </p>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {skillsToLearn.map((skill, si) => {
              const tutorials = getTutorials(skill)
              return (
                <div key={skill} style={{ padding:'14px 16px', borderRadius:14, background:'white', border:'1px solid #E2E8F0', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:'#6366F1', display:'inline-block' }}/>
                    <p style={{ fontFamily:"'Sora',sans-serif", fontSize:14, fontWeight:700, color:'#1E293B', textTransform:'capitalize' }}>{skill}</p>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {tutorials.map((t, ti) => (
                      <a key={ti} href={t.url} target="_blank" rel="noopener noreferrer"
                        style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10,
                          background:'#F8FAFC', border:'1px solid #E2E8F0', textDecoration:'none',
                          transition:'all 0.18s', cursor:'pointer' }}
                        onMouseEnter={e => { e.currentTarget.style.background='#EFF6FF'; e.currentTarget.style.borderColor='#C7D2FE' }}
                        onMouseLeave={e => { e.currentTarget.style.background='#F8FAFC'; e.currentTarget.style.borderColor='#E2E8F0' }}>
                        <span style={{ fontSize:14, flexShrink:0 }}>
                          {ti === 0 ? '📖' : '▶'}
                        </span>
                        <span style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:600, color:'#4338CA', flex:1 }}>
                          {t.title}
                        </span>
                        <span style={{ fontSize:11, color:'#94A3B8' }}>↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Score Hero ─────────────────────────────────────────────────────────────────
function ScoreHero({ result }) {
  const final    = result?.scores?.final_score || 0
  const pct      = Math.round(final * 100)
  const bert     = Math.round((result?.scores?.bert_score || 0) * 100)
  const tfidf    = Math.round((result?.scores?.tfidf_score || 0) * 100)
  const kwRate   = Math.round((result?.keyword_analysis?.keyword_match_rate || 0) * 100)
  const rec      = result?.recommendation || 'partial_match'
  const cfg = {
    strong_match:  { label:'Strong Match ✅', bg:'#ECFDF5', border:'#A7F3D0', text:'#065F46' },
    good_match:    { label:'Good Match 👍',   bg:'#EFF6FF', border:'#BFDBFE', text:'#1E40AF' },
    partial_match: { label:'Partial Match 🔶', bg:'#FFFBEB', border:'#FDE68A', text:'#92400E' },
    poor_match:    { label:'Poor Match ❌',   bg:'#FFF1F2', border:'#FECDD3', text:'#881337' },
  }[rec] || { label:'Analyzed', bg:'#EFF6FF', border:'#BFDBFE', text:'#1E40AF' }

  return (
    <motion.div initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }}
      style={{ padding:'24px 28px', borderRadius:20, background:cfg.bg, border:`2px solid ${cfg.border}`,
        display:'flex', flexWrap:'wrap', alignItems:'center', gap:24, position:'relative', overflow:'hidden' }}>
      {/* BG decoration */}
      <div style={{ position:'absolute', right:-30, top:-30, width:160, height:160, borderRadius:'50%',
        background:`${cfg.text}08`, pointerEvents:'none' }}/>

      {/* Score ring */}
      <div style={{ flexShrink:0 }}>
        <ScoreRing score={final} size={120} label="ATS Score"/>
      </div>

      {/* Text info */}
      <div style={{ flex:1, minWidth:180 }}>
        <span style={{ display:'inline-block', padding:'4px 14px', borderRadius:20, marginBottom:10,
          background:`${cfg.text}12`, border:`1px solid ${cfg.border}`,
          fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:14, color:cfg.text }}>
          {cfg.label}
        </span>
        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'#374151', lineHeight:1.65, marginBottom:14 }}>
          {result?.overall_assessment}
        </p>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {[
            { l:'BERT',     v:bert,   c:'#6366F1' },
            { l:'TF-IDF',   v:tfidf,  c:'#10B981' },
            { l:'Keywords', v:kwRate, c:'#F59E0B' },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ padding:'8px 14px', borderRadius:12, background:'white',
              border:'1px solid rgba(0,0,0,0.07)', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
              <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'#94A3B8', marginBottom:2,
                textTransform:'uppercase', letterSpacing:'0.08em' }}>{l}</p>
              <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:18, color:c }}>{v}%</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
const SAMPLE_JD = `Senior Python Developer — Build scalable AI-powered systems.

Required Skills: Python, FastAPI, MongoDB, Docker, AWS, PostgreSQL, Redis, Kubernetes

We are building the next generation of AI infrastructure. You'll design microservices, mentor engineers, and drive technical roadmaps.

Requirements:
• 5+ years Python in production
• Docker and Kubernetes experience
• Strong async programming and system design
• AWS cloud infrastructure experience`

export default function Results() {
  // ── State ─────────────────────────────────────────────────────────────────
  const [resumeFile,    setResumeFile]    = useState(null)   // uploaded File
  const [resumeId,      setResumeId]      = useState('')     // parsed resume id
  const [uploadProgress,setUploadProgress]= useState(0)
  const [uploading,     setUploading]     = useState(false)
  const [uploadDone,    setUploadDone]    = useState(false)

  const [jdMode,        setJdMode]        = useState('paste') // paste | file
  const [jdText,        setJdText]        = useState('')
  const [jdFile,        setJdFile]        = useState(null)
  const [jobTitle,      setJobTitle]      = useState('')
  const [requiredSkills,setRequiredSkills]= useState('')

  const [analyzing,     setAnalyzing]     = useState(false)
  const [result,        setResult]        = useState(null)
  const [activeTab,     setActiveTab]     = useState(0)

  const [enhancing,     setEnhancing]     = useState(false)
  const [enhanceResult, setEnhanceResult] = useState(null)
  const [generatingPDF, setGeneratingPDF] = useState(false)

  const [savedResumes,  setSavedResumes]  = useState([])

  const resultRef  = useRef(null)
  const enhanceRef = useRef(null)

// ── No resume history - only current upload ─

  // ── Resume dropzone ───────────────────────────────────────────────────────
const onResumeDrop = useCallback(async (accepted) => {
  const file = accepted[0]
  if (!file) return

  // 🔥 Delete previous resume (optional but good)
  if (resumeId) {
    try {
      await deleteResume(resumeId)
      toast.success('Previous resume cleared')
    } catch (err) {
      console.warn('Failed to delete previous resume:', err)
    }
    setResumeId('')
    setUploadDone(false)
  }

  setResumeFile(file)
  setUploading(true)
  setUploadProgress(0)

  try {
    await uploadResume(file, pct => setUploadProgress(pct))

    // 🔥 Poll until parsed (latest resume only)
    let parsed = null

    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000))

      const { data: list } = await getResumes({ page: 1, page_size: 1 })

      const latest = list.resumes?.[0]

      // ✅ Direct check (no find, no filename)
      if (latest && latest.status === 'parsed') {
        parsed = latest
        break
      }
    }

    if (parsed) {
      setResumeId(parsed.id)
      setUploadDone(true)
      toast.success('Resume uploaded and parsed ✓')
    } else {
      toast('Resume uploaded — parsing in progress…', { icon: '⏳' })
    }

  } catch (err) {
    toast.error(err.response?.data?.detail || 'Upload failed')
  } finally {
    setUploading(false)
  }

}, [resumeId])

  const { getRootProps: getResumeRootProps, getInputProps: getResumeInputProps, isDragActive: resumeDrag } = useDropzone({
    onDrop: onResumeDrop, multiple: false, disabled: uploading,
    accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] },
    maxSize: 10 * 1024 * 1024,
  })

  // ── JD file dropzone ──────────────────────────────────────────────────────
  const { getRootProps: getJDRootProps, getInputProps: getJDInputProps, isDragActive: jdDrag } = useDropzone({
    onDrop: async (accepted) => {
      const file = accepted[0]; if (!file) return
      setJdFile(file)
      // Read text from PDF/TXT/DOCX (simple text extraction for display)
      if (file.type === 'text/plain') {
        const text = await file.text(); setJdText(text)
      } else {
        toast('JD file saved — PDF/DOCX text will be extracted on analysis', { icon:'📄' })
      }
    },
    multiple: false, accept: {
      'application/pdf': ['.pdf'], 'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    }
  })

  // ── Analyze ───────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    // const rid = resumeId || savedResumes[0]?.id
    const rid = resumeId
    if (!rid) { toast.error('Upload a resume first'); return }
    const jd  = jdText.trim()
    if (jd.length < 30 && !jdFile) { toast.error('Paste a job description (min 30 chars)'); return }

    setAnalyzing(true); setResult(null); setEnhanceResult(null)
    try {
      const payload = {
        resume_id:       rid,
        job_title:       jobTitle || 'Target Role',
        job_description: jd || `See attached file: ${jdFile?.name}`,
        required_skills: requiredSkills.split(',').map(s => s.trim()).filter(Boolean),
        save_result:     true,
      }
      const { data } = await matchATS(payload)
      setResult(data)
      setActiveTab(0)
      toast.success(`ATS Score: ${Math.round(data.scores.final_score * 100)}% 🎯`)
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 300)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Analysis failed')
    } finally { setAnalyzing(false) }
  }

  // ── Enhance ───────────────────────────────────────────────────────────────
  const handleEnhance = async () => {
    const rid = resumeId
    if (!rid) { toast.error('Resume required'); return }
    setEnhancing(true)
    try {
      const { data } = await enhanceResume({
        resume_id:         rid,
        target_role:       jobTitle || '',
        tone:              'professional',
        enhancement_areas: ['summary','experience','skills','keywords'],
        job_description:   jdText,
      })
      setEnhanceResult(data)
      toast.success(`Resume enhanced! +${Math.round(data.ats_improvement_estimate * 100)}% estimated`)
      setTimeout(() => enhanceRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 300)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Enhancement failed')
    } finally { setEnhancing(false) }
  }
    const handleDownloadPDF = async () => {
      try {
        setGeneratingPDF(true)

        const resumeId = result?.resume_id || result?.id

        if (!resumeId) {
          toast.error('No resume found')
          return
        }

        const { data } = await generatePDF({
          resume_id: resumeId,
          template: "modern"
        })

        console.log("PDF URL:", data.pdf_url)

        // 🔥 DIRECT OPEN (NO BLOB, NO DOWNLOAD API)
        // window.open(data.pdf_url, "_blank")
        window.open(data.pdf_url + "?fl_attachment=true", "_blank")

        toast.success("✅ PDF opened successfully!")

      } catch (err) {
        console.error(err)

        const detail = err.response?.data?.detail
        toast.error(detail || "PDF generation failed")

      } finally {
        setGeneratingPDF(false)
      }
    }

  const rid = resumeId
  const TABS = ['Keywords', 'Skills', 'Roadmap & Resources']

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ maxWidth:900, margin:'0 auto', display:'flex', flexDirection:'column', gap:24, paddingBottom:40 }}>

      {/* ── Page Header ── */}
      <motion.div initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }}>
        <h1 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:26, color:'#0F172A', marginBottom:5 }}>
          ATS Resume Analyzer
        </h1>
        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:14, color:'#64748B' }}>
          Upload your resume · paste the job description · get AI-powered ATS scoring and skill gap analysis
        </p>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════════
          INPUT CARD — Resume + JD side by side, then Job Title + Skills
      ══════════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.08 }}
        style={{ background:'white', borderRadius:22, border:'1px solid #E2E8F0', overflow:'hidden',
          boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>

        {/* Header strip */}
        <div style={{ padding:'18px 24px', borderBottom:'1px solid #F1F5F9', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:10, background:'#EFF6FF', border:'1px solid #C7D2FE',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>📋</div>
          <div>
            <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:15, color:'#0F172A' }}>Analyze Your Resume</p>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#94A3B8' }}>Fill all sections · analysis takes ~10 seconds</p>
          </div>
        </div>

        <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:18 }}>

          {/* Row 1: Resume + JD side by side */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

            {/* ── LEFT: Resume upload ── */}
            <div>
              <label style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, color:'#374151',
                display:'block', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.07em' }}>
                1 · Your Resume
              </label>

{/* Only current upload - no history */}

              {/* Dropzone */}
              <div {...getResumeRootProps()} style={{
                padding:'22px 16px', borderRadius:14, border:`2px dashed ${resumeDrag ? '#6366F1' : uploadDone ? '#10B981' : '#E2E8F0'}`,
                background: resumeDrag ? '#EFF6FF' : uploadDone ? '#F0FDF4' : '#FAFAFA',
                textAlign:'center', cursor: uploading ? 'wait' : 'pointer', transition:'all 0.2s',
              }}>
                <input {...getResumeInputProps()}/>
                {uploading ? (
                  <div>
                    <div style={{ width:52, height:52, margin:'0 auto 12px', position:'relative' }}>
                      <svg width="52" height="52" style={{ transform:'rotate(-90deg)' }}>
                        <circle cx="26" cy="26" r="22" fill="none" stroke="#E2E8F0" strokeWidth="4"/>
                        <circle cx="26" cy="26" r="22" fill="none" stroke="#6366F1" strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={138.2}
                          strokeDashoffset={138.2 - (uploadProgress/100)*138.2}
                          style={{ transition:'stroke-dashoffset 0.3s ease' }}/>
                      </svg>
                      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center',
                        fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:13, color:'#6366F1' }}>{uploadProgress}%</div>
                    </div>
                    <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:600, color:'#374151' }}>
                      {uploadProgress === 100 ? 'AI Parsing...' : 'Uploading...'}
                    </p>
                  </div>
                ) : uploadDone ? (
                  <div>
                    <div style={{ fontSize:28, marginBottom:6 }}>✅</div>
                    <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:13, color:'#065F46' }}>
                      {resumeFile?.name || savedResumes.find(r=>r.id===resumeId)?.original_filename || 'Resume ready'}
                    </p>
                    <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:'#94A3B8', marginTop:3 }}>Parsed · Click to replace</p>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize:28, marginBottom:8 }}>📄</div>
                    <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:600, fontSize:13, color:'#374151' }}>
                      {resumeDrag ? 'Drop it here' : 'Drop PDF / DOCX here'}
                    </p>
                    <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:'#94A3B8', marginTop:3 }}>or click to browse · max 10MB</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT: JD input ── */}
            <div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <label style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, color:'#374151',
                  textTransform:'uppercase', letterSpacing:'0.07em' }}>
                  2 · Job Description
                </label>
                <div style={{ display:'flex', gap:4 }}>
                  {['paste','file'].map(m => (
                    <button key={m} onClick={() => setJdMode(m)}
                      style={{ padding:'3px 10px', borderRadius:8, border:'1.5px solid',
                        fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:600, cursor:'pointer', transition:'all 0.15s',
                        ...(jdMode===m
                          ? { background:'#EFF6FF', borderColor:'#C7D2FE', color:'#4338CA' }
                          : { background:'white',  borderColor:'#E2E8F0',  color:'#94A3B8' })
                      }}>
                      {m === 'paste' ? '✏ Paste' : '📎 File'}
                    </button>
                  ))}
                </div>
              </div>

              {jdMode === 'paste' ? (
                <div style={{ position:'relative' }}>
                  <textarea
                    value={jdText}
                    onChange={e => setJdText(e.target.value)}
                    placeholder="Paste the full job description here...&#10;&#10;Include: required skills, responsibilities, qualifications, and any preferred skills mentioned in the listing."
                    style={{
                      width:'100%', height:190, padding:'12px 14px', borderRadius:14,
                      border:`1.5px solid ${jdText.length > 50 ? '#A7F3D0' : '#E2E8F0'}`,
                      fontFamily:"'Inter',sans-serif", fontSize:12.5, color:'#374151', lineHeight:1.7,
                      resize:'none', outline:'none', background:'#FAFAFA', boxSizing:'border-box',
                      transition:'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor='#A5B4FC'}
                    onBlur={e => e.target.style.borderColor=jdText.length > 50 ? '#A7F3D0' : '#E2E8F0'}
                  />
                  <div style={{ position:'absolute', bottom:8, right:10, display:'flex', gap:8 }}>
                    <button onClick={() => setJdText(SAMPLE_JD)}
                      style={{ padding:'3px 9px', borderRadius:7, background:'#EFF6FF', border:'1px solid #C7D2FE',
                        fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:600, color:'#4338CA', cursor:'pointer' }}>
                      Load sample
                    </button>
                    {jdText && (
                      <button onClick={() => setJdText('')}
                        style={{ padding:'3px 9px', borderRadius:7, background:'#F8FAFC', border:'1px solid #E2E8F0',
                          fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#94A3B8', cursor:'pointer' }}>
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div {...getJDRootProps()} style={{
                  height:190, borderRadius:14, border:`2px dashed ${jdDrag ? '#6366F1' : jdFile ? '#10B981' : '#E2E8F0'}`,
                  background: jdDrag ? '#EFF6FF' : jdFile ? '#F0FDF4' : '#FAFAFA',
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8,
                  cursor:'pointer', transition:'all 0.2s', textAlign:'center', padding:16,
                }}>
                  <input {...getJDInputProps()}/>
                  {jdFile ? (
                    <>
                      <div style={{ fontSize:28 }}>✅</div>
                      <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:13, color:'#065F46' }}>{jdFile.name}</p>
                      <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:'#94A3B8' }}>Click to replace</p>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize:28 }}>📎</div>
                      <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:600, fontSize:13, color:'#374151' }}>
                        {jdDrag ? 'Drop JD file' : 'Upload JD Document'}
                      </p>
                      <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:'#94A3B8' }}>PDF · DOCX · TXT</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Job Title + Required Skills in one row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div>
              <label style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, color:'#374151',
                display:'block', marginBottom:7, textTransform:'uppercase', letterSpacing:'0.07em' }}>
                3 · Job Title <span style={{ color:'#F59E0B', fontFamily:"'Inter',sans-serif", fontWeight:600, textTransform:'none', letterSpacing:'normal', fontSize:11 }}>required</span>
              </label>
              <input value={jobTitle} onChange={e => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Python Developer"
                style={{ width:'100%', padding:'11px 14px', borderRadius:12, border:'1.5px solid #E2E8F0',
                  fontFamily:"'Inter',sans-serif", fontSize:13.5, color:'#374151', outline:'none',
                  boxSizing:'border-box', background:'#FAFAFA', transition:'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor='#A5B4FC'}
                onBlur={e => e.target.style.borderColor='#E2E8F0'}
              />
            </div>
            <div>
              <label style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, color:'#374151',
                display:'block', marginBottom:7, textTransform:'uppercase', letterSpacing:'0.07em' }}>
                4 · Required Skills <span style={{ color:'#94A3B8', fontFamily:"'Inter',sans-serif", fontWeight:400, textTransform:'none', letterSpacing:'normal', fontSize:11 }}>optional</span>
              </label>
              <input value={requiredSkills} onChange={e => setRequiredSkills(e.target.value)}
                placeholder="python, docker, aws, kubernetes (comma separated)"
                style={{ width:'100%', padding:'11px 14px', borderRadius:12, border:'1.5px solid #E2E8F0',
                  fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#374151', outline:'none',
                  boxSizing:'border-box', background:'#FAFAFA', transition:'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor='#A5B4FC'}
                onBlur={e => e.target.style.borderColor='#E2E8F0'}
              />
            </div>
          </div>

          {/* Analyze button */}
          <motion.button
            onClick={handleAnalyze}
            disabled={analyzing || (!rid && !resumeId)}
            whileHover={{ scale: analyzing ? 1 : 1.008 }}
            whileTap={{ scale: analyzing ? 1 : 0.99 }}
            style={{
              width:'100%', padding:'14px 0', borderRadius:14, border:'none', cursor: analyzing ? 'not-allowed' : 'pointer',
              fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:15, color:'white',
              background: analyzing ? '#94A3B8' : 'linear-gradient(135deg,#1565C0 0%,#1976D2 50%,#2196F3 100%)',
              boxShadow: analyzing ? 'none' : '0 4px 16px rgba(21,101,192,0.38)',
              transition:'background 0.2s, box-shadow 0.2s',
            }}>
            {analyzing ? (
              <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                <svg style={{ width:16, height:16 }} className="animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle style={{ opacity:0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path style={{ opacity:0.8 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Computing AI Score...
              </span>
            ) : '🎯  Analyze & Score Resume'}
          </motion.button>

          {/* Info chips */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
            {['BERT Semantic · 60%','TF-IDF Keywords · 40%','Skill Gap Analysis','ATS Optimization Tips'].map(t => (
              <span key={t} style={{ padding:'3px 10px', borderRadius:20, background:'#F8FAFC', border:'1px solid #E2E8F0',
                fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#64748B' }}>{t}</span>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════════
          LOADING ANIMATION
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {analyzing && (
          <motion.div initial={{ opacity:0, scale:0.97 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
            style={{ background:'white', borderRadius:22, border:'1px solid #E2E8F0', padding:'60px 40px',
              display:'flex', flexDirection:'column', alignItems:'center', gap:20, textAlign:'center',
              boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ position:'relative', width:72, height:72 }}>
              <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'4px solid #EFF6FF', borderTopColor:'#6366F1' }} className="animate-spin"/>
              <div style={{ position:'absolute', inset:8, borderRadius:'50%', border:'3px solid #ECFDF5', borderBottomColor:'#10B981' }} className="animate-spin" style2={{ animationDirection:'reverse', animationDuration:'1.4s' }}/>
              <div style={{ position:'absolute', inset:16, borderRadius:'50%', border:'2px solid #FFFBEB', borderTopColor:'#F59E0B' }} className="animate-spin" style2={{ animationDuration:'2s' }}/>
            </div>
            <div>
              <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:19, color:'#0F172A', marginBottom:6 }}>
                AI is scoring your resume
              </p>
              <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#94A3B8' }}>
                Running BERT embeddings · Extracting TF-IDF vectors · Matching skills...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          RESULTS SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {result && !analyzing && (
          <motion.div ref={resultRef}
            initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
            transition={{ duration:0.5, ease:[0.16,1,0.3,1] }}
            style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Score hero */}
            <ScoreHero result={result}/>

            {/* Tab bar */}
            <div style={{ display:'flex', gap:4, background:'#F1F5F9', padding:4, borderRadius:14, border:'1px solid #E2E8F0' }}>
              {TABS.map((tab, i) => (
                <button key={tab} onClick={() => setActiveTab(i)}
                  style={{
                    flex:1, padding:'9px 12px', borderRadius:10, border:'none', cursor:'pointer',
                    fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight: activeTab===i ? 600 : 500,
                    transition:'all 0.18s',
                    ...(activeTab===i
                      ? { background:'white', color:'#4338CA', boxShadow:'0 1px 6px rgba(0,0,0,0.08)', border:'1px solid rgba(99,102,241,0.15)' }
                      : { background:'transparent', color:'#94A3B8' }
                    ),
                  }}>
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
              <motion.div key={activeTab}
                initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
                transition={{ duration:0.22 }}
                style={{ background:'white', borderRadius:20, border:'1px solid #E2E8F0', padding:'22px 24px',
                  boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
                {activeTab === 0 && <KeywordsTab result={result}/>}
                {activeTab === 1 && <SkillsTab   result={result}/>}
                {activeTab === 2 && <RoadmapTab  result={result}/>}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          AI ENHANCER + PDF DOWNLOAD SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {result && !analyzing && (
          <motion.div ref={enhanceRef}
            initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
            transition={{ duration:0.5, delay:0.2 }}
            style={{ background:'white', borderRadius:22, border:'1px solid #E2E8F0',
              overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>

            {/* Header */}
            <div style={{ padding:'18px 24px', borderBottom:'1px solid #F1F5F9',
              background:'linear-gradient(135deg,#FFFBEB 0%,#FEF3C7 100%)',
              display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:10, background:'#FEF3C7', border:'1px solid #FDE68A',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>✨</div>
                <div>
                  <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:15, color:'#92400E' }}>
                    AI Resume Enhancer
                  </p>
                  <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#B45309' }}>
                    Optimize keywords · Strengthen language · Download ATS-friendly PDF
                  </p>
                </div>
              </div>
              {enhanceResult && (
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:12,
                  background:'#ECFDF5', border:'1px solid #A7F3D0' }}>
                  <span style={{ fontSize:14 }}>✅</span>
                  <span style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:14, color:'#065F46' }}>
                    +{Math.round((enhanceResult.ats_improvement_estimate||0)*100)}% estimated improvement
                  </span>
                </div>
              )}
            </div>

            <div style={{ padding:'22px 24px', display:'flex', flexDirection:'column', gap:16 }}>

              {/* Enhance result display */}
              <AnimatePresence>
                {enhanceResult && (
                  <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0 }}>
                    {/* Enhancement notes */}
                    {enhanceResult.enhancement_notes?.length > 0 && (
                      <div style={{ padding:'14px 16px', borderRadius:14, background:'#F0FDF4', border:'1px solid #BBF7D0', marginBottom:14 }}>
                        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, color:'#15803D', marginBottom:8 }}>
                          What was improved:
                        </p>
                        {enhanceResult.enhancement_notes.slice(0,4).map((n, i) => (
                          <p key={i} style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'#166534', marginBottom:5, display:'flex', gap:7 }}>
                            <span style={{ color:'#10B981', flexShrink:0 }}>✓</span>{n}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* Summary diff */}
                    {(enhanceResult.original_summary || enhanceResult.enhanced_summary) && (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
                        <div style={{ padding:'12px 14px', borderRadius:12, background:'#FFF1F2', border:'1px solid #FECDD3' }}>
                          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:700, color:'#9F1239', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:7 }}>
                            ● Before
                          </p>
                          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#374151', lineHeight:1.65 }}>
                            {enhanceResult.original_summary || 'Original summary'}
                          </p>
                        </div>
                        <div style={{ padding:'12px 14px', borderRadius:12, background:'#F0FDF4', border:'1px solid #BBF7D0' }}>
                          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:700, color:'#15803D', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:7 }}>
                            ● After (AI Enhanced)
                          </p>
                          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#374151', lineHeight:1.65 }}>
                            {enhanceResult.enhanced_summary || '—'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Added keywords */}
                    {enhanceResult.added_keywords?.length > 0 && (
                      <div style={{ marginBottom:14 }}>
                        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, color:'#374151', marginBottom:8 }}>
                          Keywords added to resume:
                        </p>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                          {enhanceResult.added_keywords.map(k => (
                            <span key={k} style={{ padding:'3px 10px', borderRadius:8, background:'#ECFDF5',
                              border:'1px solid #A7F3D0', fontFamily:"'JetBrains Mono',monospace", fontSize:11,
                              color:'#065F46', fontWeight:600 }}>+ {k}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action buttons */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <motion.button
                  onClick={handleEnhance}
                  disabled={enhancing}
                  whileHover={{ scale: enhancing ? 1 : 1.01 }}
                  whileTap={{ scale: enhancing ? 1 : 0.98 }}
                  style={{
                    padding:'13px 0', borderRadius:14, border:'none', cursor: enhancing ? 'not-allowed' : 'pointer',
                    fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:14, color:'white',
                    background: enhancing ? '#94A3B8' : 'linear-gradient(135deg,#D97706,#F59E0B)',
                    boxShadow: enhancing ? 'none' : '0 4px 14px rgba(217,119,6,0.35)',
                    transition:'all 0.2s',
                  }}>
                  {enhancing ? (
                    <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      <svg style={{ width:15, height:15 }} className="animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle style={{ opacity:0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path style={{ opacity:0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Enhancing...
                    </span>
                  ) : '✨  Enhance with AI'}
                </motion.button>

                <motion.button
                  onClick={handleDownloadPDF}
                  disabled={generatingPDF || !result}
                  whileHover={{ scale: (generatingPDF || !result) ? 1 : 1.01 }}
                  whileTap={{ scale: (generatingPDF || !result) ? 1 : 0.98 }}
                  style={{
                    padding:'13px 0', borderRadius:14, border:'none', 
                    cursor: generatingPDF || !result ? 'not-allowed' : 'pointer',
                    fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:14, color:'white',
                    background: generatingPDF || !result ? '#94A3B8' : 'linear-gradient(135deg,#065F46,#059669)',
                    boxShadow: (generatingPDF || !result) ? 'none' : '0 4px 14px rgba(5,150,105,0.35)',
                    transition:'all 0.2s',
                  }}>
                  {generatingPDF ? (
                    <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      <svg style={{ width:15, height:15 }} className="animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle style={{ opacity:0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path style={{ opacity:0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      Generating PDF...
                    </span>
                  ) : !result ? 'Run Analysis First' : '⬇ Download Resume PDF'}
                </motion.button>
              </div>

              <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#94A3B8', textAlign:'center' }}>
                Enhanced resume is ATS-optimized · Includes all improvements above
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}