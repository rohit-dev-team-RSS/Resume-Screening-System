/**
 * InterviewReport — Full dashboard report after interview completion
 * Shows: overall score, per-question breakdown, AI feedback, cheating score, radar chart
 */
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, Cell,
} from 'recharts'

const TIP = {
  contentStyle: { background:'#fff', border:'1px solid #E2E8F0', borderRadius:12, fontFamily:"'Inter',sans-serif", fontSize:12 },
  cursor: { fill:'rgba(99,102,241,0.05)' },
}

// ── Score ring (SVG) ──────────────────────────────────────────────────────────
function ScoreCircle({ score = 0, label, size = 110 }) {
  const r   = size / 2 - 10
  const circ = 2 * Math.PI * r
  const off  = circ - (score / 100) * circ
  const c    = score >= 80 ? '#10B981' : score >= 60 ? '#6366F1' : score >= 40 ? '#F59E0B' : '#F43F5E'
  const grade= score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B+' : score >= 60 ? 'B' : score >= 50 ? 'C' : 'D'

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div style={{ position:'relative', width:size, height:size }}>
        <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={8}/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={8}
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
            style={{ transition:'stroke-dashoffset 1.5s cubic-bezier(0.16,1,0.3,1)', filter:`drop-shadow(0 0 6px ${c}60)` }}/>
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:size*0.22, color:c, lineHeight:1 }}>
            {Math.round(score)}
          </span>
          <span style={{ fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:11, color:c, marginTop:2 }}>{grade}</span>
        </div>
      </div>
      <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:600, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</p>
    </div>
  )
}

// ── Recommendation badge ──────────────────────────────────────────────────────
function HiringBadge({ rec }) {
  const cfg = {
    'Strong Yes': { bg:'#ECFDF5', border:'#A7F3D0', text:'#065F46', icon:'✅' },
    'Yes':        { bg:'#EFF6FF', border:'#BFDBFE', text:'#1E40AF', icon:'👍' },
    'Maybe':      { bg:'#FFFBEB', border:'#FDE68A', text:'#92400E', icon:'🤔' },
    'No':         { bg:'#FFF1F2', border:'#FECDD3', text:'#881337', icon:'❌' },
  }[rec] || { bg:'#F1F5F9', border:'#CBD5E1', text:'#475569', icon:'📋' }

  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background:cfg.bg, border:`1.5px solid ${cfg.border}` }}>
      <span>{cfg.icon}</span>
      <div>
        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:cfg.text, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>Hiring Recommendation</p>
        <p style={{ fontFamily:"'Sora',sans-serif", fontSize:16, fontWeight:800, color:cfg.text }}>{rec}</p>
      </div>
    </div>
  )
}

// ── Q&A accordion ─────────────────────────────────────────────────────────────
function AnswerCard({ item, index }) {
  const score = item.evaluation?.overall_score || 0
  const c = score >= 80 ? '#10B981' : score >= 60 ? '#6366F1' : score >= 40 ? '#F59E0B' : '#F43F5E'
  const bg= score >= 80 ? '#ECFDF5' : score >= 60 ? '#EFF6FF' : score >= 40 ? '#FFFBEB' : '#FFF1F2'
  const br= score >= 80 ? '#A7F3D0' : score >= 60 ? '#BFDBFE' : score >= 40 ? '#FDE68A' : '#FECDD3'

  return (
    <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:index*0.06 }}
      className="rounded-2xl border overflow-hidden" style={{ borderColor:br }}>
      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between gap-4" style={{ background:bg }}>
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background:c }}>
            {String(index+1).padStart(2,'0')}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider font-mono" style={{ color:c }}>{item.category}</span>
              {item.reattempted && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-mono">Reattempted</span>}
              {item.answer_source === 'voice' && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-mono">🎤 Voice</span>}
            </div>
            <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:600, fontSize:14, color:'#0F172A', lineHeight:1.5 }}>
              {item.question_text}
            </p>
          </div>
        </div>
        <div className="text-center shrink-0">
          <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:22, color:c, lineHeight:1 }}>{Math.round(score)}</p>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:10, color:'#64748B' }}>/ 100</p>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:c }}>{item.evaluation?.grade || 'N/A'}</p>
        </div>
      </div>

      {/* Answer */}
      <div className="px-5 py-4 bg-white border-t border-slate-100">
        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Your Answer</p>
        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'#374151', lineHeight:1.7, background:'#F8FAFC', padding:'10px 14px', borderRadius:10 }}>
          {item.answer || '—'}
        </p>

        {/* Scores grid */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { label:'Relevance',  val:item.evaluation?.relevance_score  },
            { label:'Clarity',    val:item.evaluation?.clarity_score    },
            { label:'Confidence', val:item.evaluation?.confidence_score },
            { label:'Technical',  val:item.evaluation?.technical_score  },
          ].map(({ label, val }) => {
            const v = Math.round(val || 0)
            const cc = v >= 70 ? '#10B981' : v >= 50 ? '#6366F1' : '#F59E0B'
            return (
              <div key={label} className="text-center p-2.5 rounded-xl" style={{ background:'#F8FAFC', border:'1px solid #E2E8F0' }}>
                <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:18, color:cc }}>{v}</p>
                <p style={{ fontFamily:"'Inter',sans-serif", fontSize:9, color:'#94A3B8', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</p>
              </div>
            )
          })}
        </div>

        {/* AI Feedback */}
        {item.evaluation?.feedback && (
          <div className="mt-4 p-3.5 rounded-xl" style={{ background:'#F0F9FF', border:'1px solid #BAE6FD' }}>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#0369A1', marginBottom:4 }}>🤖 AI Feedback</p>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'#075985', lineHeight:1.6 }}>{item.evaluation.feedback}</p>
          </div>
        )}

        {/* Ideal answer */}
        {item.evaluation?.ideal_answer_summary && (
          <div className="mt-3 p-3.5 rounded-xl" style={{ background:'#F0FDF4', border:'1px solid #BBF7D0' }}>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#15803D', marginBottom:4 }}>💡 Model Answer</p>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'#166534', lineHeight:1.6 }}>{item.evaluation.ideal_answer_summary}</p>
          </div>
        )}

        {/* Improvement tips */}
        {item.evaluation?.improvement_tips?.length > 0 && (
          <div className="mt-3">
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#64748B', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>Improvement Tips</p>
            <div className="space-y-1.5">
              {item.evaluation.improvement_tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-xs font-body text-slate-600">
                  <span style={{ color:'#6366F1', flexShrink:0, marginTop:1 }}>→</span>{tip}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Keywords */}
        {(item.evaluation?.keywords_found?.length > 0 || item.evaluation?.keywords_missing?.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {item.evaluation.keywords_found?.slice(0,6).map(k => (
              <span key={k} className="px-2 py-0.5 rounded-lg text-xs font-mono" style={{ background:'#ECFDF5', color:'#065F46', border:'1px solid #A7F3D0' }}>✓ {k}</span>
            ))}
            {item.evaluation.keywords_missing?.slice(0,6).map(k => (
              <span key={k} className="px-2 py-0.5 rounded-lg text-xs font-mono" style={{ background:'#FFF1F2', color:'#881337', border:'1px solid #FECDD3' }}>✕ {k}</span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Main Report ───────────────────────────────────────────────────────────────
export default function InterviewReport({ reportData, cheatingData, answers, onRestart }) {
  if (!reportData) return null
  const { session, summary } = reportData
  const overall = session?.overall_score || 0
  const cheatPct= Math.round((cheatingData?.score || session?.cheating_score || 0) * 100)
  const warnings = cheatingData?.warning_count || session?.warning_count || 0

  const radarData = summary?.skill_radar ? [
    { skill:'Technical',   score: summary.skill_radar.technical_knowledge || 0 },
    { skill:'Communication',score:summary.skill_radar.communication || 0 },
    { skill:'Problem Solving',score:summary.skill_radar.problem_solving || 0 },
    { skill:'Confidence',  score: summary.skill_radar.confidence || 0 },
    { skill:'Readiness',   score: summary.skill_radar.interview_readiness || 0 },
  ] : []

  const barData = answers.map((a, i) => ({
    name: `Q${i+1}`,
    score: Math.round(a.evaluation?.overall_score || 0),
  }))

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* ── Hero ── */}
      <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }}
        className="relative rounded-3xl overflow-hidden p-8"
        style={{ background:'linear-gradient(135deg,#071B38 0%,#0A2347 20%,#1246A0 65%,#1565C0 100%)' }}>
        <div style={{ position:'absolute', inset:0, opacity:0.07,
          backgroundImage:'radial-gradient(circle,rgba(255,255,255,0.7) 1px,transparent 1px)',
          backgroundSize:'28px 28px', pointerEvents:'none' }}/>

        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'rgba(255,255,255,0.6)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>
              Interview Complete ✓
            </p>
            <h1 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:30, color:'white', lineHeight:1.2, marginBottom:12 }}>
              {session?.job_title || 'Interview'} Report
            </h1>
            {summary?.hiring_recommendation && (
              <HiringBadge rec={summary.hiring_recommendation}/>
            )}
          </div>

          {/* Score circles */}
          <div className="flex items-center gap-6 flex-wrap">
            <ScoreCircle score={overall}  label="Overall"    size={110}/>
            <ScoreCircle score={session?.avg_confidence || 0} label="Confidence" size={90}/>
            <ScoreCircle score={session?.avg_clarity    || 0} label="Clarity"    size={90}/>
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: cheatPct > 50 ? 'rgba(239,68,68,0.2)' : cheatPct > 20 ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)', border:`3px solid ${cheatPct > 50 ? '#F43F5E' : cheatPct > 20 ? '#F59E0B' : '#10B981'}` }}>
                <div className="text-center">
                  <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:18, color: cheatPct > 50 ? '#F43F5E' : cheatPct > 20 ? '#F59E0B' : '#10B981', lineHeight:1 }}>{cheatPct}%</p>
                  <p style={{ fontSize:9, color:'rgba(255,255,255,0.6)', fontFamily:"'Inter',sans-serif" }}>{warnings}⚠</p>
                </div>
              </div>
              <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.6)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Integrity</p>
            </div>
          </div>
        </div>

        {summary?.executive_summary && (
          <div className="relative mt-5 p-4 rounded-2xl" style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)' }}>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:14, color:'rgba(255,255,255,0.85)', lineHeight:1.65 }}>
              "{summary.executive_summary}"
            </p>
          </div>
        )}
      </motion.div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Radar */}
        {radarData.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:15, color:'#0F172A', marginBottom:4 }}>Skill Radar</h3>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#94A3B8', marginBottom:16 }}>Multi-dimensional performance</p>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#E2E8F0" gridType="polygon"/>
                <PolarAngleAxis dataKey="skill" tick={{ fill:'#64748B', fontSize:11, fontFamily:"'Inter',sans-serif" }}/>
                <Radar name="Score" dataKey="score" stroke="#6366F1" fill="#6366F1" fillOpacity={0.15} strokeWidth={2.5}
                  dot={{ fill:'#6366F1', r:3 }}/>
                <Tooltip {...TIP} formatter={v => [`${v}`, 'Score']}/>
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Bar scores */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:15, color:'#0F172A', marginBottom:4 }}>Score per Question</h3>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#94A3B8', marginBottom:16 }}>Individual answer evaluation</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ left:-15 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#F1F5F9" vertical={false}/>
              <XAxis dataKey="name" tick={{ fill:'#64748B', fontSize:11 }} tickLine={false} axisLine={false}/>
              <YAxis domain={[0,100]} tick={{ fill:'#64748B', fontSize:11 }} tickLine={false} axisLine={false}/>
              <Tooltip {...TIP} formatter={v => [`${v}/100`, 'Score']}/>
              <Bar dataKey="score" radius={[6,6,0,0]} maxBarSize={36}>
                {barData.map((d,i) => (
                  <Cell key={i} fill={d.score >= 80 ? '#10B981' : d.score >= 60 ? '#6366F1' : d.score >= 40 ? '#F59E0B' : '#F43F5E'}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Strengths / Gaps / Next Steps ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title:'Top Strengths', items:summary?.top_strengths || session?.strength_areas || [], color:'#10B981', bg:'#ECFDF5', border:'#A7F3D0', icon:'✅' },
          { title:'Critical Gaps', items:summary?.critical_gaps  || session?.weakness_areas || [], color:'#F43F5E', bg:'#FFF1F2', border:'#FECDD3', icon:'⚠️' },
          { title:'Next Steps',    items:summary?.next_steps     || [], color:'#6366F1', bg:'#EFF6FF', border:'#BFDBFE', icon:'🚀' },
        ].map(({ title, items, color, bg, border, icon }) => (
          <div key={title} className="rounded-2xl p-5" style={{ background:bg, border:`1.5px solid ${border}` }}>
            <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:13, color, marginBottom:12 }}>{icon} {title}</p>
            <div className="space-y-2">
              {items.slice(0,4).map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-xs font-body" style={{ color }}>
                  <span style={{ flexShrink:0, marginTop:2 }}>→</span>{item}
                </div>
              ))}
              {items.length === 0 && <p className="text-xs text-slate-400 font-mono">—</p>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Q&A Breakdown ── */}
      <div>
        <h2 style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:18, color:'#0F172A', marginBottom:16 }}>
          Question-by-Question Breakdown
        </h2>
        <div className="space-y-4">
          {answers.map((item, i) => (
            <AnswerCard key={i} item={item} index={i}/>
          ))}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="grid grid-cols-2 gap-4 pt-2">
        <button onClick={onRestart}
          className="py-4 rounded-2xl font-semibold text-sm text-indigo-700 transition-all hover:-translate-y-0.5"
          style={{ border:'2px solid #C7D2FE', background:'#EFF6FF', fontFamily:"'Sora',sans-serif" }}>
          🔄 Start New Interview
        </button>
        <Link to="/interview-analytics"
          className="py-4 rounded-2xl font-semibold text-sm text-white text-center transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
          style={{ background:'linear-gradient(135deg,#1565C0,#2196F3)', boxShadow:'0 4px 14px rgba(21,101,192,0.35)', fontFamily:"'Sora',sans-serif" }}>
          📊 View All Analytics
        </Link>
      </div>
    </div>
  )
}
