import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { getMyAnalytics, getATSHistory, getResumes } from '../services/api'
import ScoreRing from '../components/ScoreRing'
import { AnimatedNumber, AnimatedBar } from '../components/AnimatedNumber'
import { ScoreTrendChart } from '../components/Charts'

const MOCK = {
  summary: { total_ats_checks: 18, average_score: 0.72, best_score: 0.89, strong_matches: 4, good_matches: 8, poor_matches: 6 },
  score_trend: [
    { date: 'Jan 10', score: 0.50 }, { date: 'Jan 18', score: 0.61 }, { date: 'Jan 25', score: 0.67 },
    { date: 'Feb 3', score: 0.63 }, { date: 'Feb 12', score: 0.74 }, { date: 'Feb 20', score: 0.81 },
    { date: 'Mar 1', score: 0.89 },
  ],
  top_missing_skills: [
    { skill: 'kubernetes', frequency: 8 }, { skill: 'terraform', frequency: 6 },
    { skill: 'graphql', frequency: 5 }, { skill: 'rust', frequency: 3 }, { skill: 'kafka', frequency: 2 },
  ],
  improvement_tips: [
    'Add measurable achievements — "Improved API performance by 40%"',
    'Include Kubernetes and Terraform for DevOps roles',
    'Quantify team size in leadership roles',
  ],
}

const MOCK_HISTORY = [
  { result_id: '1', final_score: 0.89, recommendation: 'strong_match', matched_keywords_count: 34, created_at: '2025-03-01' },
  { result_id: '2', final_score: 0.74, recommendation: 'good_match', matched_keywords_count: 26, created_at: '2025-02-20' },
  { result_id: '3', final_score: 0.51, recommendation: 'partial_match', matched_keywords_count: 18, created_at: '2025-02-12' },
]

function StatCard({ label, value, suffix = '', icon, color, bg, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`card p-5 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300 cursor-default hover:shadow-lg`}
    >
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-1/2 translate-x-1/3 ${bg} opacity-50`} />
      <div className={`w-10 h-10 rounded-xl ${bg} border ${color.replace('text-', 'border-').replace('-700', '-200')} flex items-center justify-center text-lg mb-4`}>
        {icon}
      </div>
      <p className="label-sm mb-1">{label}</p>
      <p className={`font-display font-700 text-4xl leading-none ${color}`}>
        <AnimatedNumber value={typeof value === 'number' ? value : 0} suffix={suffix}/>
        {typeof value === 'string' && value}
      </p>
    </motion.div>
  )
}

function QuickAction({ to, icon, title, desc, colorClass, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link to={to} className="card p-4 flex items-center gap-4 group hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 block">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${colorClass} transition-transform duration-300 group-hover:scale-110`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-600 text-sm text-ink-800 font-body">{title}</p>
          <p className="text-xs text-ink-400 font-body mt-0.5">{desc}</p>
        </div>
        <svg className="w-4 h-4 text-ink-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
        </svg>
      </Link>
    </motion.div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [analytics, setAnalytics] = useState(null)
  const [history, setHistory] = useState(MOCK_HISTORY)
  const [resumes, setResumes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getMyAnalytics().catch(() => ({ data: MOCK })),
      // getATSHistory({ page_size: 5 }).catch(() => ({ data: { items: MOCK_HISTORY } })),
      // getResumes({ page_size: 5 }).catch(() => ({ data: { resumes: [] } })),
    ]).then(([a, h, r]) => {
      setAnalytics(a.data || MOCK)
      // setHistory(h.data?.items || MOCK_HISTORY)
      // setResumes(r.data?.resumes || [])
    }).finally(() => setLoading(false))
  }, [])

  const s = analytics?.summary || MOCK.summary
  const trend = analytics?.score_trend || MOCK.score_trend
  const missing = analytics?.top_missing_skills || MOCK.top_missing_skills
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.full_name?.split(' ')[0] || 'there'

  const QUICK = [
    { to: '/upload', icon: '📄', title: 'Upload Resume', desc: 'PDF or DOCX — AI parses instantly', colorClass: 'bg-indigo-50 text-indigo-600', delay: 0.35 },
    { to: '/results', icon: '🎯', title: 'Run ATS Match', desc: 'Score against a job description', colorClass: 'bg-emerald-50 text-emerald-600', delay: 0.40 },
    { to: '/analytics', icon: '📈', title: 'View Analytics', desc: 'Track your career progress', colorClass: 'bg-amber-50 text-amber-600', delay: 0.45 },
    { to: '/interview', icon: '🎤', title: 'Mock Interview', desc: 'AI-generated questions', colorClass: 'bg-sky-50 text-sky-600', delay: 0.50 },
    { to: '/enhance', icon: '✨', title: 'Enhance Resume', desc: 'LLM-powered improvements', colorClass: 'bg-violet-50 text-violet-600', delay: 0.55 },
    { to: '/github', icon: '🐙', title: 'GitHub Analysis', desc: 'Analyze your tech profile', colorClass: 'bg-rose-50 text-rose-600', delay: 0.60 },
  ]

  if (loading) return (
    <div className="space-y-6">
      <div className="h-36 bg-cream-200 rounded-3xl animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 skeleton" />)}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 pb-6">
      {/* Hero Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-3xl p-7 bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 shadow-indigo-lg"
      >
        {/* Background patterns */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute -bottom-16 -left-10 w-60 h-60 rounded-full bg-indigo-400/20 blur-2xl" />
          <div className="absolute inset-0 bg-dots opacity-10" style={{ backgroundSize: '28px 28px' }} />
        </div>

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-soft" />
              <span className="font-mono text-2xs text-indigo-300 tracking-widest uppercase">Career Intelligence Active</span>
            </div>
            <h2 className="font-display font-700 text-3xl md:text-4xl text-white mb-2 leading-tight">
              {greeting}, {firstName} 👋
            </h2>
            <p className="font-body text-indigo-200 text-sm leading-relaxed max-w-lg">
              Your career score is{' '}
              <span className="text-white font-600">trending upward</span>. You've run {s.total_ats_checks} ATS analyses with a {Math.round(s.average_score * 100)}% average score.
            </p>
            <div className="flex gap-3 mt-5 flex-wrap">
              <Link to="/upload" className="btn-primary bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-sm shadow-none hover:shadow-none text-sm px-5 py-2.5">
                + Upload Resume
              </Link>
              <Link to="/results" className="btn-ghost text-indigo-200 hover:text-white hover:bg-white/10 text-sm px-5 py-2.5 rounded-xl border border-white/10">
                Run ATS Check →
              </Link>
            </div>
          </div>

          <div className="shrink-0">
            <div className="relative">
              <div className="absolute -inset-4 bg-white/5 rounded-full blur-xl" />
              <ScoreRing score={s.average_score} size={140} label="Avg Score" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="ATS Analyses" value={s.total_ats_checks} icon="📊" color="text-indigo-700" bg="bg-indigo-50" delay={0.1}/>
        <StatCard label="Best Score" value={`${Math.round(s.best_score * 100)}%`} icon="⭐" color="text-amber-600" bg="bg-amber-50" delay={0.15}/>
        <StatCard label="Strong Matches" value={s.strong_matches} icon="✅" color="text-emerald-700" bg="bg-emerald-50" delay={0.2}/>
        <StatCard label="Resumes" value={user?.total_resumes || resumes.length || 0} icon="📄" color="text-sky-700" bg="bg-sky-50" delay={0.25}/>
      </div>

      {/* Middle Row — Chart + Skills */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-display font-600 text-ink-800 text-lg">Score Trend</h3>
              <p className="text-xs text-ink-400 font-body mt-0.5">ATS performance over time</p>
            </div>
            <span className="badge-indigo">Last 90 days</span>
          </div>
          <ScoreTrendChart data={trend} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-display font-600 text-ink-800 text-lg">Top Skill Gaps</h3>
              <p className="text-xs text-ink-400 font-body mt-0.5">Missing from job descriptions</p>
            </div>
            <Link to="/results" className="text-xs text-indigo-600 font-600 hover:text-indigo-800 transition-colors">Analyze →</Link>
          </div>
          <div className="space-y-4">
            {missing.slice(0, 5).map((sk, i) => {
              const pct = Math.round((sk.frequency / missing[0].frequency) * 100)
              const colors = ['#F43F5E', '#F59E0B', '#8B5CF6', '#6366F1', '#0EA5E9']
              return (
                <div key={sk.skill}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs font-600 text-ink-600 font-body capitalize">{sk.skill}</span>
                    <span className="text-2xs font-mono text-ink-400">{sk.frequency}× missing</span>
                  </div>
                  <AnimatedBar value={pct} color={colors[i]} delay={i * 120} height={7}/>
                </div>
              )
            })}
          </div>
          <Link to="/results" className="btn-secondary w-full mt-5 text-xs py-2">
            Run Skill Analysis →
          </Link>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-600 text-ink-800">Quick Actions</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {QUICK.map(q => <QuickAction key={q.to} {...q} />)}
          </div>
        </div>

        {/* Recent ATS History */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-600 text-ink-800">Recent ATS Checks</h3>
            <Link to="/results" className="text-xs text-indigo-600 font-600 hover:text-indigo-800 transition-colors">View all →</Link>
          </div>
          <div className="space-y-3">
            {history.length === 0 ? (
              <div className="card p-10 text-center">
                <p className="text-4xl mb-3">🎯</p>
                <p className="font-600 text-ink-600 font-body">No checks yet</p>
                <p className="text-xs text-ink-400 mt-1 font-body">Run your first ATS analysis</p>
                <Link to="/results" className="btn-primary mt-4 text-sm">Start Matching →</Link>
              </div>
            ) : (
              history.map((h, i) => {
                const score = h.final_score || 0
                const pct = Math.round(score * 100)
                const cfg = score >= 0.8
                  ? { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'badge-emerald' }
                  : score >= 0.6
                  ? { color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', badge: 'badge-indigo' }
                  : score >= 0.4
                  ? { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'badge-amber' }
                  : { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', badge: 'badge-rose' }
                return (
                  <motion.div key={h.result_id}
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className={`flex items-center gap-4 p-4 rounded-2xl border ${cfg.bg} ${cfg.border}`}
                  >
                    <div className={`w-14 h-14 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0`}>
                      <span className={`font-display font-700 text-xl ${cfg.color}`}>{pct}%</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-600 text-sm font-body capitalize ${cfg.color}`}>
                        {h.recommendation?.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-ink-400 font-mono mt-0.5">
                        {h.matched_keywords_count || 0} keywords · {h.created_at?.slice(0, 10)}
                      </p>
                    </div>
                    <span className={`badge ${cfg.badge} text-2xs`}>{pct}%</span>
                  </motion.div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Tips Banner */}
      {analytics?.improvement_tips?.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
          className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center">
              <span className="text-amber-600 text-sm">💡</span>
            </div>
            <h3 className="font-display font-600 text-ink-800">AI Career Tips</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {analytics.improvement_tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-amber-700 text-2xs font-700">{i + 1}</span>
                </div>
                <p className="text-xs text-ink-700 font-body leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
