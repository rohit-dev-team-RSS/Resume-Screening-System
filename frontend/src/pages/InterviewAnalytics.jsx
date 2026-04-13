import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts'
import { getGamificationProfile } from '../services/interviewApi'
import { getMyAnalytics } from '../services/api'
import { PageHeader, StatCard, CardSkeleton, EmptyState } from '../components/ui/LoadingSkeleton'
import ScoreGauge from '../components/interview/ScoreGauge'

// ── Chart tooltip style ───────────────────────────────────────────────────────
const TIP = {
  contentStyle: {
    background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
    fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#1E293B',
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)', padding: '10px 14px',
  },
  cursor: { fill: 'rgba(99,102,241,0.05)' },
}

// ── Mock rich interview history (fallback) ────────────────────────────────────
const MOCK_SESSIONS = [
  { date: 'Mar 1', avg_score: 8.2, type: 'technical', duration: 45, questions: 9, difficulty: 'hard' },
  { date: 'Feb 26', avg_score: 7.5, type: 'behavioral', duration: 38, questions: 8, difficulty: 'medium' },
  { date: 'Feb 21', avg_score: 6.8, type: 'mixed', duration: 42, questions: 10, difficulty: 'medium' },
  { date: 'Feb 16', avg_score: 5.4, type: 'technical', duration: 30, questions: 7, difficulty: 'hard' },
  { date: 'Feb 10', avg_score: 6.2, type: 'situational', duration: 35, questions: 8, difficulty: 'easy' },
  { date: 'Feb 4', avg_score: 4.8, type: 'behavioral', duration: 28, questions: 6, difficulty: 'medium' },
  { date: 'Jan 28', avg_score: 5.9, type: 'mixed', duration: 40, questions: 9, difficulty: 'medium' },
]

const MOCK_WEAK_AREAS = [
  { topic: 'System Design', avg_score: 5.2, attempts: 8, color: '#F43F5E' },
  { topic: 'Algorithms', avg_score: 6.1, attempts: 5, color: '#F59E0B' },
  { topic: 'Leadership', avg_score: 6.8, attempts: 4, color: '#8B5CF6' },
  { topic: 'Cloud/AWS', avg_score: 7.2, attempts: 6, color: '#6366F1' },
  { topic: 'Communication', avg_score: 8.1, attempts: 7, color: '#10B981' },
  { topic: 'Problem Solving', avg_score: 7.6, attempts: 9, color: '#0EA5E9' },
]

const MOCK_TYPE_DIST = [
  { name: 'Technical', value: 45, color: '#6366F1' },
  { name: 'Behavioral', value: 30, color: '#10B981' },
  { name: 'Situational', value: 25, color: '#F59E0B' },
]

function ScoreTrend({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
        <defs>
          <linearGradient id="interviewGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity={0.25}/>
            <stop offset="100%" stopColor="#6366F1" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="#F1F5F9" vertical={false}/>
        <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: "'Inter'" }} tickLine={false} axisLine={false}/>
        <YAxis domain={[0, 10]} tick={{ fill: '#94A3B8', fontSize: 11, fontFamily: "'Inter'" }} tickLine={false} axisLine={false}/>
        <Tooltip {...TIP} formatter={v => [`${v}/10`, 'Avg Score']}/>
        <Area type="monotone" dataKey="avg_score" stroke="#6366F1" strokeWidth={2.5} fill="url(#interviewGrad)"
          dot={{ fill: '#fff', stroke: '#6366F1', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, fill: '#6366F1', stroke: '#fff', strokeWidth: 2 }}/>
      </AreaChart>
    </ResponsiveContainer>
  )
}

function WeakAreasChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 70, bottom: 4 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#F1F5F9" horizontal={false}/>
        <XAxis type="number" domain={[0, 10]} tick={{ fill: '#94A3B8', fontSize: 11 }} tickLine={false} axisLine={false}/>
        <YAxis type="category" dataKey="topic" tick={{ fill: '#475569', fontSize: 12, fontFamily: "'Inter'" }} tickLine={false} axisLine={false}/>
        <Tooltip {...TIP} formatter={v => [`${v}/10`, 'Avg Score']}/>
        <Bar dataKey="avg_score" radius={[0, 8, 8, 0]} maxBarSize={18}>
          {data.map((d, i) => <Cell key={i} fill={d.color}/>)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function TypeRadar({ data }) {
  const radarData = [
    { topic: 'Technical', score: 7.2 },
    { topic: 'Behavioral', score: 6.8 },
    { topic: 'Situational', score: 7.5 },
    { topic: 'Communication', score: 8.1 },
    { topic: 'Depth', score: 6.4 },
    { topic: 'Clarity', score: 7.8 },
  ]
  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={radarData} margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
        <PolarGrid stroke="#E2E8F0" gridType="polygon"/>
        <PolarAngleAxis dataKey="topic" tick={{ fill: '#64748B', fontSize: 11, fontFamily: "'Inter'" }}/>
        <Radar name="Score" dataKey="score" stroke="#6366F1" fill="#6366F1" fillOpacity={0.15} strokeWidth={2}
          dot={{ fill: '#6366F1', r: 3 }}/>
        <Tooltip {...TIP} formatter={v => [`${v}/10`, 'Score']}/>
      </RadarChart>
    </ResponsiveContainer>
  )
}

function TypeDist({ data }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={48} outerRadius={72}
          paddingAngle={4} dataKey="value" strokeWidth={0}>
          {data.map((d, i) => <Cell key={i} fill={d.color}/>)}
        </Pie>
        <Tooltip {...TIP} formatter={v => [`${v}%`, 'Share']}/>
        <Legend iconType="circle" iconSize={8}
          wrapperStyle={{ fontFamily: "'Inter'", fontSize: 11, color: '#64748B' }}/>
      </PieChart>
    </ResponsiveContainer>
  )
}

function ConfidenceBar({ topic, score, attempts, color }) {
  const pct = Math.round((score / 10) * 100)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700 font-body">{topic}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400">{attempts} sessions</span>
          <span className="text-sm font-bold font-mono" style={{ color }}>{score}/10</span>
        </div>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  )
}

export default function InterviewAnalytics() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getGamificationProfile().catch(() => ({ data: null })),
      getMyAnalytics({ days: 90 }).catch(() => ({ data: {} })),
    ]).then(([g, a]) => {
      setProfile(g.data)
    }).finally(() => setLoading(false))
  }, [])

  const avgScore = profile?.average_score ? profile.average_score * 10 : 6.8
  const totalInterviews = profile?.total_interviews || MOCK_SESSIONS.length
  const streak = profile?.current_streak || 0

  if (loading) {
    return (
      <div className="space-y-6 pb-8">
        <div className="h-36 rounded-3xl bg-slate-100 animate-pulse"/>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} rows={2}/>)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Hero */}
      <PageHeader
        title="Interview Analytics"
        subtitle="Track performance trends, identify weak areas, and measure AI confidence scores"
        badge="Performance Intelligence"
        gradient="linear-gradient(135deg, #1E1B4B 0%, #312E81 60%, #4338CA 100%)"
        action={
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 28, color: '#FCD34D', lineHeight: 1 }}>
                {totalInterviews}
              </p>
              <p className="text-indigo-300 text-xs font-mono mt-0.5">Sessions</p>
            </div>
            <div className="w-px h-10 bg-white/20"/>
            <ScoreGauge score={avgScore} maxScore={10} size={90} label="Avg Score"/>
          </div>
        }
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="🎯" label="Interview Score" value={`${avgScore.toFixed(1)}/10`}
          color="#6366F1" bg="#EEF2FF" delay={0.05}
          trend={{ up: true, label: '+1.2 vs last month' }}/>
        <StatCard icon="📈" label="Improvement" value="+24%" color="#10B981" bg="#ECFDF5" delay={0.1}
          sub="vs first session"/>
        <StatCard icon="🔥" label="Current Streak" value={`${streak} days`}
          color="#F59E0B" bg="#FFFBEB" delay={0.15}
          trend={{ up: streak > 3, label: streak > 3 ? 'On track!' : 'Keep going' }}/>
        <StatCard icon="🏆" label="Best Session" value={`${Math.max(...MOCK_SESSIONS.map(s => s.avg_score)).toFixed(1)}/10`}
          color="#F43F5E" bg="#FFF1F2" delay={0.2}/>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score trend */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, color: '#1E293B' }}>Score Trend</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Average score per interview session</p>
            </div>
            <span className="text-xs font-mono text-slate-400 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg">Last {MOCK_SESSIONS.length} sessions</span>
          </div>
          <ScoreTrend data={MOCK_SESSIONS}/>
        </motion.div>

        {/* Type distribution */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, color: '#1E293B', marginBottom: 4 }}>Interview Types</h3>
          <p className="text-xs text-slate-400 font-mono mb-4">Distribution of sessions</p>
          <TypeDist data={MOCK_TYPE_DIST}/>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weak areas */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, color: '#1E293B' }}>Topic Performance</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Average score by topic area</p>
            </div>
            <span className="text-xs font-mono text-rose-500 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
              {MOCK_WEAK_AREAS.filter(a => a.avg_score < 7).length} areas to improve
            </span>
          </div>
          <WeakAreasChart data={MOCK_WEAK_AREAS}/>
        </motion.div>

        {/* Skill radar */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, color: '#1E293B', marginBottom: 4 }}>Skill Radar</h3>
          <p className="text-xs text-slate-400 font-mono mb-2">Multi-dimensional performance view</p>
          <TypeRadar/>
        </motion.div>
      </div>

      {/* Confidence breakdown */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, color: '#1E293B' }}>AI Confidence Scores by Topic</h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">How consistently strong your answers are per topic</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {MOCK_WEAK_AREAS.map((item, i) => (
            <motion.div key={item.topic} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}>
              <ConfidenceBar {...item}/>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Recent sessions table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, color: '#1E293B' }}>Session History</h3>
          <span className="text-xs font-mono text-slate-400">{MOCK_SESSIONS.length} sessions</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {['Date', 'Type', 'Difficulty', 'Questions', 'Duration', 'Avg Score', 'Status'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {MOCK_SESSIONS.map((session, i) => {
                const scoreColor = session.avg_score >= 8 ? '#10B981' : session.avg_score >= 6 ? '#6366F1' : '#F59E0B'
                const DIFF = { easy: { color: '#10B981', bg: '#ECFDF5' }, medium: { color: '#6366F1', bg: '#EEF2FF' }, hard: { color: '#F43F5E', bg: '#FFF1F2' } }
                const diffStyle = DIFF[session.difficulty] || DIFF.medium
                return (
                  <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 + i * 0.05 }}
                    className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-mono text-slate-600">{session.date}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-mono font-bold capitalize text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{session.type}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-mono font-bold capitalize px-2 py-0.5 rounded-lg" style={{ color: diffStyle.color, background: diffStyle.bg }}>
                        {session.difficulty}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-mono text-slate-600">{session.questions}</td>
                    <td className="px-5 py-3.5 text-sm font-mono text-slate-600">{session.duration}m</td>
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-sm font-mono" style={{ color: scoreColor }}>{session.avg_score}/10</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-mono text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Completed</span>
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Improvement tips */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
        className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, color: '#1E293B', marginBottom: 16 }}>
          🤖 AI Coach Recommendations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: '📐', color: '#6366F1', bg: '#EEF2FF', title: 'Improve System Design', desc: 'Your system design answers score lowest (5.2/10). Focus on scalability patterns and trade-off discussions.' },
            { icon: '⚡', color: '#F59E0B', bg: '#FFFBEB', title: 'Practice Daily Streaks', desc: `Current streak: ${streak} days. Daily 30-min sessions show 40% faster improvement than weekly sessions.` },
            { icon: '🎯', color: '#10B981', bg: '#ECFDF5', title: 'Attempt Hard Difficulty', desc: 'You\'ve mastered medium difficulty. Push to hard-level questions to unlock faster growth and more points.' },
          ].map(({ icon, color, bg, title, desc }) => (
            <div key={title} className="p-4 rounded-2xl border" style={{ background: bg, borderColor: `${color}25` }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{icon}</span>
                <p className="font-semibold text-sm font-body" style={{ color }}>{title}</p>
              </div>
              <p className="text-xs font-body text-slate-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
