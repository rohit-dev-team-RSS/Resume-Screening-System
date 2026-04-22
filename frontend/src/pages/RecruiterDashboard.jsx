import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useDropzone } from 'react-dropzone'
import api, { analyzeGitHub, generatePDF } from '../services/api'

// ─── utils ────────────────────────────────────────────────────────────────────
const pct = v => Math.round((v || 0) * 100)
const sc  = p => p >= 80 ? '#10B981' : p >= 60 ? '#6366F1' : p >= 40 ? '#F59E0B' : '#F43F5E'
const sb  = p => p >= 80 ? { bg:'#ECFDF5', bd:'#A7F3D0', tx:'#065F46' }
                : p >= 60 ? { bg:'#EFF6FF', bd:'#BFDBFE', tx:'#1E40AF' }
                : p >= 40 ? { bg:'#FFFBEB', bd:'#FDE68A', tx:'#92400E' }
                :            { bg:'#FFF1F2', bd:'#FECDD3', tx:'#881337' }

const LANG_CLR = { Python:'#3572A5', JavaScript:'#F7DF1E', TypeScript:'#2B7489',
  Go:'#00ADD8', Rust:'#DEA584', Java:'#B07219', 'C++':'#F34B7D' }

const SAMPLE_JD = `Senior Python Developer — AI platform backend

Required Skills: Python, FastAPI, MongoDB, Docker, AWS, PostgreSQL, Redis

Requirements:
• 5+ years Python production experience
• Strong async + system design skills
• Cloud infrastructure (AWS preferred)
• Docker and container orchestration`

// ─── MiniBar ──────────────────────────────────────────────────────────────────
function Bar({ label, val, color }) {
  const p = pct(val)
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
        <span style={{ fontFamily:"'Inter',sans-serif", fontSize:10, color:'#94A3B8', fontWeight:600 }}>{label}</span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:700, color }}>{p}%</span>
      </div>
      <div style={{ height:4, borderRadius:100, background:'#F1F5F9', overflow:'hidden' }}>
        <motion.div initial={{ width:0 }} animate={{ width:`${p}%` }} transition={{ duration:1, ease:[0.16,1,0.3,1] }}
          style={{ height:'100%', borderRadius:100, background:color }}/>
      </div>
    </div>
  )
}

// ─── GitHub Hover Card ────────────────────────────────────────────────────────
function GHCard({ username }) {
  const [d, setD] = useState(null)
  const [ld, setLd] = useState(false)
  const [open, setOpen] = useState(false)
  const t = useRef(null)

  const load = useCallback(async () => {
    if (d || ld || !username) return
    setLd(true)
    try { const { data } = await analyzeGitHub({ username }); setD(data.data || data) }
    catch { setD({ err: true }) }
    finally { setLd(false) }
  }, [d, ld, username])

  if (!username) return (
    <span style={{ padding:'5px 11px', borderRadius:10, border:'1.5px solid #E2E8F0',
      background:'#F8FAFC', fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:600, color:'#CBD5E1' }}>
      🐙 GitHub
    </span>
  )

  const langs = Object.entries(d?.languages || {}).slice(0,3)

  return (
    <div style={{ position:'relative', display:'inline-block' }}
      onMouseEnter={() => { t.current = setTimeout(() => { setOpen(true); load() }, 200) }}
      onMouseLeave={() => { clearTimeout(t.current); setOpen(false) }}>
      <motion.span whileHover={{ scale:1.04 }}
        style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 11px', borderRadius:10,
          border:`1.5px solid ${d && !d.err ? '#C7D2FE' : '#E2E8F0'}`,
          background: d && !d.err ? '#EFF6FF' : '#F8FAFC',
          fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:600,
          color: d && !d.err ? '#4338CA' : '#64748B', cursor:'pointer', userSelect:'none' }}>
        <svg style={{ width:13, height:13 }} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
        </svg>
        @{username}
        {ld && <span style={{ width:7, height:7, borderRadius:'50%', border:'2px solid #6366F1',
          borderTopColor:'transparent', display:'inline-block', animation:'spin 0.7s linear infinite' }}/>}
      </motion.span>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity:0, y:8, scale:0.97 }} animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:8, scale:0.97 }} transition={{ duration:0.15 }}
            onMouseEnter={() => clearTimeout(t.current)}
            onMouseLeave={() => setOpen(false)}
            style={{ position:'absolute', bottom:'calc(100% + 8px)', left:'50%', transform:'translateX(-50%)',
              width:290, zIndex:500, background:'white', borderRadius:16,
              border:'1.5px solid #E2E8F0', boxShadow:'0 16px 40px rgba(0,0,0,0.13)', overflow:'hidden' }}>

            {ld && !d ? (
              <div style={{ padding:'28px', textAlign:'center' }}>
                <div style={{ width:24, height:24, margin:'0 auto 8px', borderRadius:'50%',
                  border:'3px solid #EFF6FF', borderTopColor:'#6366F1', animation:'spin 0.8s linear infinite' }}/>
                <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#94A3B8' }}>Loading...</p>
              </div>
            ) : d?.err ? (
              <div style={{ padding:'20px', textAlign:'center' }}>
                <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'#F43F5E' }}>⚠ Unavailable</p>
              </div>
            ) : d ? (
              <>
                <div style={{ padding:'12px 14px', background:'#0F172A', display:'flex', alignItems:'center', gap:10 }}>
                  {d.profile?.avatar_url
                    ? <img src={d.profile.avatar_url} alt="" style={{ width:34, height:34, borderRadius:8, border:'2px solid #334155' }}/>
                    : <div style={{ width:34, height:34, borderRadius:8, background:'#334155', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🐙</div>
                  }
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:13, color:'white', lineHeight:1.2 }}>
                      {d.profile?.name || username}
                    </p>
                    <a href={`https://github.com/${username}`} target="_blank" rel="noopener noreferrer"
                      style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#64748B', textDecoration:'none' }}>
                      @{username} ↗
                    </a>
                  </div>
                  {d.contribution_score !== undefined && (
                    <div style={{ textAlign:'center' }}>
                      <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:17, lineHeight:1,
                        color: pct(d.contribution_score) >= 70 ? '#34D399' : '#FBBF24' }}>{pct(d.contribution_score)}%</p>
                      <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:8, color:'#475569' }}>SCORE</p>
                    </div>
                  )}
                </div>

                <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5 }}>
                    {[['Repos', d.profile?.public_repos||0],['Stars', d.total_stars||0],['Stack', d.tech_stack?.length||0]].map(([l,v]) => (
                      <div key={l} style={{ textAlign:'center', padding:'5px 3px', borderRadius:7, background:'#F8FAFC', border:'1px solid #F1F5F9' }}>
                        <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:14, color:'#1E293B', lineHeight:1 }}>{v}</p>
                        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:9, color:'#94A3B8', marginTop:1 }}>{l}</p>
                      </div>
                    ))}
                  </div>

                  {langs.length > 0 && (
                    <div>
                      <p style={{ fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:700, color:'#64748B',
                        textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>Languages</p>
                      {langs.map(([lang, count]) => {
                        const max = langs[0][1]; const p = Math.round((count/max)*100)
                        const clr = LANG_CLR[lang] || '#6366F1'
                        return (
                          <div key={lang} style={{ display:'flex', alignItems:'center', gap:7, marginBottom:4 }}>
                            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'#475569', width:68, flexShrink:0 }}>{lang}</span>
                            <div style={{ flex:1, height:4, borderRadius:100, background:'#F1F5F9', overflow:'hidden' }}>
                              <div style={{ height:'100%', borderRadius:100, background:clr, width:`${p}%` }}/>
                            </div>
                            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'#94A3B8', width:18, textAlign:'right' }}>{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {d.activity_level && (
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontFamily:"'Inter',sans-serif", fontSize:10, color:'#64748B' }}>Activity</span>
                      <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600, fontFamily:"'Inter',sans-serif",
                        background: d.activity_level==='very_active' ? '#ECFDF5' : d.activity_level==='active' ? '#EFF6FF' : '#F8FAFC',
                        color:      d.activity_level==='very_active' ? '#065F46' : d.activity_level==='active' ? '#1E40AF' : '#94A3B8',
                        border:     d.activity_level==='very_active' ? '1px solid #A7F3D0' : d.activity_level==='active' ? '1px solid #BFDBFE' : '1px solid #E2E8F0' }}>
                        {d.activity_level.replace('_',' ')}
                      </span>
                    </div>
                  )}

                  {d.top_repositories?.slice(0,2).map(r => (
                    <a key={r.name} href={r.url} target="_blank" rel="noopener noreferrer"
                      style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 9px',
                        borderRadius:7, background:'#F8FAFC', border:'1px solid #E2E8F0', textDecoration:'none' }}>
                      <span style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:600, color:'#374151',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:170 }}>{r.name}</span>
                      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#F59E0B', flexShrink:0 }}>★ {r.stars}</span>
                    </a>
                  ))}
                </div>
              </>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ─── Candidate Card ───────────────────────────────────────────────────────────
function CandidateCard({ c, idx }) {
  const s = pct(c.final_score)
  const color = sc(s)
  const bg = sb(s)

  const REC = {
    strong_match:'✅ Strong Match', good_match:'👍 Good Match',
    partial_match:'🔶 Partial',     poor_match:'❌ Poor Match',
  }[c.recommendation] || '—'

  const download = async () => {
    try {
      toast('Generating PDF…', { icon:'⏳' })
      const { data } = await generatePDF({ resume_id: c.resume_id, template:'ats_friendly' })
      if (data.download_url) window.open(data.download_url, '_blank')
      else toast.error('PDF not available for this resume')
    } catch { toast.error('Download failed') }
  }

  return (
    <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
      transition={{ delay: idx * 0.04, duration:0.35, ease:[0.16,1,0.3,1] }}
      whileHover={{ y:-3, boxShadow:'0 12px 32px rgba(0,0,0,0.10)' }}
      style={{ background:'white', borderRadius:20, border:`1.5px solid ${bg.bd}`,
        boxShadow:'0 2px 8px rgba(0,0,0,0.05)', overflow:'hidden', transition:'box-shadow 0.2s, transform 0.2s' }}>
      <div style={{ height:4, background:`linear-gradient(90deg,${color},${color}88)` }}/>
      <div style={{ padding:'18px 18px 16px' }}>

        {/* Top row: rank + name + score */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:12 }}>
          <div style={{ width:34, height:34, borderRadius:10, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:13,
            background: idx===0?'linear-gradient(135deg,#F59E0B,#D97706)':idx===1?'linear-gradient(135deg,#94A3B8,#64748B)':idx===2?'linear-gradient(135deg,#CD7F32,#A0522D)':'#F1F5F9',
            color: idx<=2?'white':'#94A3B8' }}>
            #{c.rank}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:14, color:'#0F172A',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:2 }}>
              {c.name || 'Candidate'}
            </p>
            {c.email && (
              <a href={`mailto:${c.email}`}
                style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#6366F1', textDecoration:'none' }}>
                {c.email}
              </a>
            )}
          </div>
          <div style={{ textAlign:'center', flexShrink:0 }}>
            <div style={{ width:48, height:48, borderRadius:'50%', display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center', background:bg.bg, border:`2px solid ${bg.bd}` }}>
              <span style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:15, color, lineHeight:1 }}>{s}</span>
              <span style={{ fontFamily:"'Inter',sans-serif", fontSize:7, color, fontWeight:700 }}>%</span>
            </div>
          </div>
        </div>

        {/* Rec badge */}
        <div style={{ display:'inline-flex', padding:'3px 9px', borderRadius:20, marginBottom:10,
          background:bg.bg, border:`1px solid ${bg.bd}` }}>
          <span style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:600, color:bg.tx }}>{REC}</span>
        </div>

        {/* Score bars */}
        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
          <Bar label="BERT Semantic" val={c.bert_score}  color="#6366F1"/>
          <Bar label="TF-IDF Match"  val={c.tfidf_score} color="#10B981"/>
          <Bar label="Overall ATS"   val={c.final_score} color={color}/>
        </div>

        {/* Matched skills */}
        {c.matched_skills?.length > 0 && (
          <div style={{ marginBottom:10 }}>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:700, color:'#64748B',
              textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>Matched</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
              {c.matched_skills.slice(0,6).map(sk => (
                <span key={sk} style={{ padding:'2px 7px', borderRadius:6, background:'#ECFDF5',
                  border:'1px solid #A7F3D0', fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'#065F46', fontWeight:600 }}>
                  ✓ {sk}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Missing skills */}
        {c.missing_skills?.length > 0 && (
          <div style={{ marginBottom:12 }}>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:9, fontWeight:700, color:'#94A3B8',
              textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:5 }}>Missing</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:3 }}>
              {c.missing_skills.slice(0,4).map(sk => (
                <span key={sk} style={{ padding:'2px 7px', borderRadius:6, background:'#FFF1F2',
                  border:'1px solid #FECDD3', fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'#9F1239', fontWeight:600 }}>
                  ✕ {sk}
                </span>
              ))}
            </div>
          </div>
        )}

        {c.experience_years > 0 && (
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:'#64748B', marginBottom:10 }}>
            🗓 {c.experience_years}y experience
          </p>
        )}

        <div style={{ height:1, background:'#F1F5F9', marginBottom:12 }}/>

        {/* Actions */}
        <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
          <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }} onClick={download}
            style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:9,
              border:'1.5px solid #C7D2FE', background:'#EFF6FF', cursor:'pointer',
              fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:600, color:'#4338CA' }}>
            <svg style={{ width:12, height:12 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Resume
          </motion.button>

          <GHCard username={c.github_username || ''}/>

          {c.linkedin_url && (
            <motion.a whileHover={{ scale:1.03 }} href={c.linkedin_url} target="_blank" rel="noopener noreferrer"
              style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:9,
                border:'1.5px solid #BAE6FD', background:'#F0F9FF', cursor:'pointer', textDecoration:'none',
                fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:600, color:'#0369A1' }}>
              <svg style={{ width:11, height:11 }} viewBox="0 0 24 24" fill="#0A66C2">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              LinkedIn
            </motion.a>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function RecruiterDashboard() {
  const [jdMode,    setJdMode]    = useState('paste')
  const [jdText,    setJdText]    = useState('')
  const [jdFile,    setJdFile]    = useState(null)
  const [jobTitle,  setJobTitle]  = useState('')
  const [skills,    setSkills]    = useState('')
  const [minScore,  setMinScore]  = useState(0)
  const [topN,      setTopN]      = useState(20)
  const [loading,   setLoading]   = useState(false)
  const [candidates,setCandidates]= useState([])
  const [summary,   setSummary]   = useState(null)
  const [filterRec, setFilterRec] = useState('all')
  const [sortBy,    setSortBy]    = useState('score')
  const ref = useRef(null)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    accept: { 'application/pdf':['.pdf'], 'text/plain':['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':['.docx'] },
    onDrop: async ([f]) => {
      if (!f) return; setJdFile(f)
      if (f.type==='text/plain') { setJdText(await f.text()) }
      else toast('File saved — text extracted on match', { icon:'📄' })
    }
  })

  const runMatch = async () => {
    const jd = jdText.trim()
    if (jd.length < 30 && !jdFile) { toast.error('Paste a JD (min 30 chars)'); return }
    setLoading(true); setCandidates([]); setSummary(null)
    try {
      const { data } = await api.post('/recruiter/v2/match-jd', {
        job_title:       jobTitle || 'Target Role',
        job_description: jd || `File: ${jdFile?.name}`,
        required_skills: skills.split(',').map(s=>s.trim()).filter(Boolean),
        min_score:       minScore / 100,
        max_results: topN,
      })
      setCandidates(data.candidates || [])
      setSummary(data.summary || {})
      toast.success(`Matched ${data.total_candidates} candidates 🎯`)
      setTimeout(() => ref.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 300)
      if (!data.candidates || data.candidates.length === 0) {
        toast('⚠ No candidates found. Try different JD or skills')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Matching failed')
    } finally { setLoading(false) }
  }

  const filtered = candidates
    .filter(c => filterRec==='all' || (c.recommendation || '').toLowerCase() === filterRec)
    .sort((a,b) => sortBy==='score' ? b.final_score-a.final_score : (a.name||'').localeCompare(b.name||''))

  const jdLen = jdText.trim().length

  return (
    <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', flexDirection:'column', gap:22, paddingBottom:48 }}>

      {/* Header */}
      <motion.div initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:4 }}>
          <div style={{ width:40, height:40, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:20, background:'linear-gradient(135deg,#1E40AF,#6366F1)', boxShadow:'0 4px 12px rgba(99,102,241,0.35)' }}>🏢</div>
          <div>
            <h1 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:24, color:'#0F172A', margin:0 }}>Recruiter Dashboard</h1>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'#64748B', margin:0 }}>
              Paste a JD → AI ranks all candidates by ATS score, skill match & experience
            </p>
          </div>
        </div>
      </motion.div>

      {/* JD Input Card */}
      <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.06 }}
        style={{ background:'white', borderRadius:22, border:'1px solid #E2E8F0',
          boxShadow:'0 2px 12px rgba(0,0,0,0.06)', overflow:'hidden' }}>

        <div style={{ padding:'16px 22px', borderBottom:'1px solid #F1F5F9',
          background:'linear-gradient(135deg,#EFF6FF,#F8FAFC)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:10, background:'#DBEAFE', border:'1px solid #BFDBFE',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>📋</div>
          <div>
            <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:14, color:'#1E293B', margin:0 }}>Job Description</p>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#94A3B8', margin:0 }}>Paste or upload the JD to rank all platform candidates</p>
          </div>
        </div>

        <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:14 }}>
          {/* JD mode toggle */}
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <label style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#374151',
                textTransform:'uppercase', letterSpacing:'0.07em' }}>Job Description *</label>
              <div style={{ display:'flex', gap:4 }}>
                {['paste','file'].map(m => (
                  <button key={m} onClick={() => setJdMode(m)}
                    style={{ padding:'3px 11px', borderRadius:8, border:'1.5px solid', cursor:'pointer',
                      fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:600, transition:'all 0.15s',
                      ...(jdMode===m ? { background:'#EFF6FF', borderColor:'#C7D2FE', color:'#4338CA' }
                                     : { background:'white', borderColor:'#E2E8F0', color:'#94A3B8' }) }}>
                    {m==='paste' ? '✏ Paste' : '📎 File'}
                  </button>
                ))}
              </div>
            </div>

            {jdMode==='paste' ? (
              <div style={{ position:'relative' }}>
                <textarea value={jdText} onChange={e => setJdText(e.target.value)}
                  placeholder="Paste the full job description here...&#10;&#10;Include: required skills, responsibilities, qualifications."
                  style={{ width:'100%', height:190, padding:'13px 14px', borderRadius:14, resize:'none', outline:'none',
                    border:`1.5px solid ${jdLen>50?'#A7F3D0':'#E2E8F0'}`, background:'#FAFAFA',
                    fontFamily:"'Inter',sans-serif", fontSize:13, color:'#374151', lineHeight:1.7,
                    boxSizing:'border-box', transition:'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor='#A5B4FC'}
                  onBlur={e => e.target.style.borderColor=jdLen>50?'#A7F3D0':'#E2E8F0'}/>
                <div style={{ position:'absolute', bottom:10, right:12, display:'flex', gap:6 }}>
                  <button onClick={() => setJdText(SAMPLE_JD)}
                    style={{ padding:'3px 9px', borderRadius:7, background:'#EFF6FF', border:'1px solid #C7D2FE',
                      fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:600, color:'#4338CA', cursor:'pointer' }}>
                    Sample
                  </button>
                  {jdText && <button onClick={() => setJdText('')}
                    style={{ padding:'3px 9px', borderRadius:7, background:'#F8FAFC', border:'1px solid #E2E8F0',
                      fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#94A3B8', cursor:'pointer' }}>
                    Clear
                  </button>}
                </div>
                <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:jdLen>100?'#10B981':'#94A3B8', marginTop:4 }}>
                  {jdLen} chars {jdLen<30?'— need 30+':'✓'}
                </p>
              </div>
            ) : (
              <div {...getRootProps()} style={{ height:150, borderRadius:14,
                border:`2px dashed ${isDragActive?'#6366F1':jdFile?'#10B981':'#E2E8F0'}`,
                background:isDragActive?'#EFF6FF':jdFile?'#F0FDF4':'#FAFAFA',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8,
                cursor:'pointer', transition:'all 0.2s', textAlign:'center', padding:16 }}>
                <input {...getInputProps()}/>
                {jdFile ? (
                  <><div style={{ fontSize:26 }}>✅</div>
                    <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:13, color:'#065F46' }}>{jdFile.name}</p>
                    <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:'#94A3B8' }}>Click to replace</p></>
                ) : (
                  <><div style={{ fontSize:30 }}>📎</div>
                    <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:600, fontSize:13, color:'#374151' }}>
                      {isDragActive?'Drop here':'Upload JD (PDF · DOCX · TXT)'}
                    </p></>
                )}
              </div>
            )}
          </div>

          {/* Row: Job Title + Skills */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <label style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#374151',
                display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.07em' }}>Job Title</label>
              <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="e.g. Senior Python Developer"
                style={{ width:'100%', padding:'10px 13px', borderRadius:11, border:'1.5px solid #E2E8F0',
                  fontFamily:"'Inter',sans-serif", fontSize:13, color:'#374151', outline:'none',
                  boxSizing:'border-box', background:'#FAFAFA', transition:'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor='#A5B4FC'}
                onBlur={e => e.target.style.borderColor='#E2E8F0'}/>
            </div>
            <div>
              <label style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#374151',
                display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.07em' }}>
                Required Skills <span style={{ color:'#94A3B8', fontWeight:400, textTransform:'none', fontSize:10 }}>optional</span>
              </label>
              <input value={skills} onChange={e => setSkills(e.target.value)} placeholder="python, docker, aws"
                style={{ width:'100%', padding:'10px 13px', borderRadius:11, border:'1.5px solid #E2E8F0',
                  fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#374151', outline:'none',
                  boxSizing:'border-box', background:'#FAFAFA', transition:'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor='#A5B4FC'}
                onBlur={e => e.target.style.borderColor='#E2E8F0'}/>
            </div>
          </div>

          {/* Row: Min score + Top N */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <label style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#374151',
                  textTransform:'uppercase', letterSpacing:'0.07em' }}>Min Score</label>
                <span style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:14, color:'#6366F1' }}>{minScore}%</span>
              </div>
              <input type="range" min={0} max={90} step={5} value={minScore}
                onChange={e => setMinScore(Number(e.target.value))}
                style={{ width:'100%', accentColor:'#6366F1', cursor:'pointer' }}/>
              <div style={{ display:'flex', justifyContent:'space-between', fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'#94A3B8', marginTop:2 }}>
                <span>0% all</span><span>45% decent</span><span>90% elite</span>
              </div>
            </div>
            <div>
              <label style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#374151',
                display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.07em' }}>Show Top</label>
              <select value={topN} onChange={e => setTopN(Number(e.target.value))}
                style={{ width:'100%', padding:'10px 13px', borderRadius:11, border:'1.5px solid #E2E8F0',
                  fontFamily:"'Inter',sans-serif", fontSize:13, color:'#374151', background:'white', outline:'none', cursor:'pointer' }}>
                {[1, 5,20,30,50].map(n => <option key={n} value={n}>Top {n} candidates</option>)}
              </select>
            </div>
          </div>

          {/* Match button */}
          <motion.button onClick={runMatch} disabled={loading}
            whileHover={{ scale:loading?1:1.008 }} whileTap={{ scale:loading?1:0.99 }}
            style={{ width:'100%', padding:'13px 0', borderRadius:13, border:'none',
              fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:15, color:'white',
              cursor:loading?'not-allowed':'pointer',
              background:loading?'#94A3B8':'linear-gradient(135deg,#1E40AF,#4F46E5)',
              boxShadow:loading?'none':'0 4px 16px rgba(79,70,229,0.4)', transition:'all 0.2s' }}>
            {loading ? (
              <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:9 }}>
                <svg style={{ width:15, height:15 }} className="animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle style={{ opacity:0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path style={{ opacity:0.8 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Ranking candidates…
              </span>
            ) : '🏆  Find & Rank Best Candidates'}
          </motion.button>
        </div>
      </motion.div>

      {/* Loading */}
      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ background:'white', borderRadius:22, border:'1px solid #E2E8F0', padding:'56px 40px',
              display:'flex', flexDirection:'column', alignItems:'center', gap:18, textAlign:'center' }}>
            <div style={{ position:'relative', width:64, height:64 }}>
              <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'4px solid #EFF6FF', borderTopColor:'#6366F1' }} className="animate-spin"/>
              <div style={{ position:'absolute', inset:8, borderRadius:'50%', border:'3px solid #F0FDF4', borderBottomColor:'#10B981' }} className="animate-spin"/>
              <div style={{ position:'absolute', inset:16, borderRadius:'50%', border:'2px solid #FFFBEB', borderTopColor:'#F59E0B' }} className="animate-spin"/>
            </div>
            <div>
              <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:19, color:'#0F172A', marginBottom:6 }}>Ranking candidates</p>
              <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#94A3B8' }}>Running BERT + TF-IDF against all platform resumes…</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {candidates.length > 0 && !loading && (
          <motion.div ref={ref} initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
            transition={{ duration:0.45, ease:[0.16,1,0.3,1] }}
            style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Summary + controls */}
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
              {summary && (
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {[['Total', data.total_candidates,'#6366F1','#EFF6FF'],
                    ['Strong', summary.strong_matches,'#10B981','#ECFDF5'],
                    ['Good',   summary.good_matches,'#6366F1','#EFF6FF'],
                    ['Weak',   summary.poor_matches,'#F43F5E','#FFF1F2'],
                    ['Avg', `${Math.round((summary.average_score||0)*100)}%`,'#F59E0B','#FFFBEB']
                  ].map(([l,v,c,bg]) => (
                    <div key={l} style={{ padding:'7px 14px', borderRadius:11, background:bg, border:`1px solid ${c}30`, textAlign:'center', minWidth:58 }}>
                      <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:18, color:c, lineHeight:1 }}>{v}</p>
                      <p style={{ fontFamily:"'Inter',sans-serif", fontSize:9, color:'#94A3B8', marginTop:1 }}>{l}</p>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display:'flex', gap:7 }}>
                <select value={filterRec} onChange={e => setFilterRec(e.target.value)}
                  style={{ padding:'7px 11px', borderRadius:9, border:'1.5px solid #E2E8F0',
                    fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:600, color:'#374151', background:'white', cursor:'pointer', outline:'none' }}>
                  <option value="all">All matches</option>
                  <option value="strong_match">Strong only</option>
                  <option value="good_match">Good only</option>
                  <option value="partial_match">Partial only</option>
                </select>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  style={{ padding:'7px 11px', borderRadius:9, border:'1.5px solid #E2E8F0',
                    fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:600, color:'#374151', background:'white', cursor:'pointer', outline:'none' }}>
                  <option value="score">By Score</option>
                  <option value="name">By Name</option>
                </select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div style={{ background:'white', borderRadius:20, border:'1px solid #E2E8F0', padding:'40px', textAlign:'center' }}>
                <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:15, color:'#94A3B8' }}>No candidates match this filter</p>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:14 }}>
                {filtered.map((c, i) => <CandidateCard key={`${c.user_id}-${c.resume_id}`} c={c} idx={i}/>)}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!loading && candidates.length === 0 && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
          style={{ background:'white', borderRadius:22, border:'1px solid #E2E8F0', padding:'60px 40px', textAlign:'center' }}>
          <motion.div animate={{ y:[0,-8,0] }} transition={{ repeat:Infinity, duration:3 }}
            style={{ fontSize:48, marginBottom:14 }}>🏢</motion.div>
          <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:19, color:'#1E293B', marginBottom:8 }}>
            Paste a JD to find top candidates
          </p>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:14, color:'#94A3B8', maxWidth:400, margin:'0 auto 18px' }}>
            AI scores all platform resumes against your job description and ranks the best matches instantly.
          </p>
          <div style={{ display:'flex', gap:7, justifyContent:'center', flexWrap:'wrap' }}>
            {['BERT Semantic','TF-IDF Keywords','Skill Gaps','GitHub Hover'].map(t => (
              <span key={t} style={{ padding:'3px 11px', borderRadius:20, background:'#F8FAFC', border:'1px solid #E2E8F0',
                fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#94A3B8' }}>{t}</span>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
