import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getMyAnalytics, getSkillsMarket } from '../services/api'
import { ScoreTrendChart, SkillDemandChart, DistributionPie, MissingSkillsChart, SkillRadarChart } from '../components/Charts'
import { AnimatedNumber, AnimatedBar } from '../components/AnimatedNumber'

const MOCK_A = {
  summary: { total_ats_checks: 18, average_score: 0.72, best_score: 0.89, strong_matches: 4, good_matches: 8, poor_matches: 6 },
  score_trend: [
    { date: 'Jan 5', score: 0.48 },{ date: 'Jan 14', score: 0.57 },{ date: 'Jan 22', score: 0.64 },
    { date: 'Feb 1', score: 0.60 },{ date: 'Feb 10', score: 0.71 },{ date: 'Feb 19', score: 0.78 },
    { date: 'Mar 1', score: 0.89 },
  ],
  top_missing_skills: [
    { skill: 'kubernetes', frequency: 8 },{ skill: 'terraform', frequency: 6 },
    { skill: 'graphql', frequency: 5 },{ skill: 'rust', frequency: 3 },{ skill: 'kafka', frequency: 2 },
  ],
  improvement_tips: [
    'Add measurable results to each experience bullet',
    'Kubernetes expertise appears in 8 of your target JDs',
    'Update your resume every 3 months',
  ],
}
const MOCK_MARKET = [
  { skill: 'python', market_demand_score: 0.95 },{ skill: 'javascript', market_demand_score: 0.93 },
  { skill: 'aws', market_demand_score: 0.91 },{ skill: 'react', market_demand_score: 0.90 },
  { skill: 'docker', market_demand_score: 0.88 },{ skill: 'sql', market_demand_score: 0.87 },
  { skill: 'kubernetes', market_demand_score: 0.82 },{ skill: 'typescript', market_demand_score: 0.81 },
  { skill: 'tensorflow', market_demand_score: 0.78 },{ skill: 'go', market_demand_score: 0.76 },
]

function KPICard({ label, value, suffix = '', color, bg, icon, trend, delay = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="card p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center text-xl`}>{icon}</div>
        {trend && <span className="badge-emerald text-2xs">{trend}</span>}
      </div>
      <p className="label-sm mt-4 mb-1">{label}</p>
      <p className={`font-display font-700 text-3xl ${color}`}>
        <AnimatedNumber value={typeof value === 'number' ? value : 0} suffix={suffix}/>
        {typeof value === 'string' && value}
      </p>
    </motion.div>
  )
}

function ChartCard({ title, subtitle, badge, children, delay = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="card p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-display font-600 text-ink-800 text-base leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-ink-400 font-body mt-0.5">{subtitle}</p>}
        </div>
        {badge && <span className="badge-gray text-2xs">{badge}</span>}
      </div>
      {children}
    </motion.div>
  )
}

export default function Analytics() {
  const [analytics, setAnalytics] = useState(MOCK_A)
  const [market, setMarket] = useState(MOCK_MARKET)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getMyAnalytics({ days: 90 }).catch(() => ({ data: MOCK_A })),
      getSkillsMarket().catch(() => ({ data: { skills_in_demand: MOCK_MARKET } })),
    ]).then(([a, m]) => {
      setAnalytics(a.data || MOCK_A)
      setMarket(m.data?.skills_in_demand || MOCK_MARKET)
    }).finally(() => setLoading(false))
  }, [])

  const s = analytics.summary
  const SKILL_COLORS = ['#F43F5E','#F59E0B','#8B5CF6','#6366F1','#0EA5E9']

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28"/>)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-72"/>)}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 pb-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="page-title mb-1">Analytics</h2>
        <p className="text-sm text-ink-400 font-body">Career performance trends, market demand, and skill intelligence</p>
      </motion.div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total ATS Checks" value={s.total_ats_checks} icon="📊" color="text-indigo-700" bg="bg-indigo-50" delay={0.05}/>
        <KPICard label="Average Score" value={Math.round(s.average_score * 100)} suffix="%" icon="📈" color="text-amber-600" bg="bg-amber-50" trend="↑ Improving" delay={0.10}/>
        <KPICard label="Personal Best" value={Math.round(s.best_score * 100)} suffix="%" icon="⭐" color="text-emerald-700" bg="bg-emerald-50" delay={0.15}/>
        <KPICard label="Strong Matches" value={s.strong_matches} icon="✅" color="text-sky-700" bg="bg-sky-50" delay={0.20}/>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartCard title="Score Trend" subtitle="ATS performance over time" badge={`${analytics.score_trend.length} data points`} delay={0.25}>
            <ScoreTrendChart data={analytics.score_trend}/>
          </ChartCard>
        </div>
        <ChartCard title="Match Distribution" subtitle="Quality breakdown" delay={0.30}>
          <DistributionPie data={s}/>
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Market Demand by Skill" subtitle="Current hiring trends" badge="Live data" delay={0.35}>
          <SkillDemandChart data={market}/>
        </ChartCard>
        <ChartCard title="Skill Radar" subtitle="Your top skills vs market" delay={0.40}>
          <SkillRadarChart data={market}/>
        </ChartCard>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Skill Gaps" subtitle="Most frequently missing" delay={0.45}>
          <MissingSkillsChart data={analytics.top_missing_skills}/>
        </ChartCard>

        {/* Tips */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center text-sm">💡</div>
            <h3 className="font-display font-600 text-ink-800">AI Improvement Tips</h3>
          </div>
          <div className="space-y-3">
            {(analytics.improvement_tips || []).map((tip, i) => (
              <div key={i} className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-100 rounded-xl">
                <div className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-amber-700 text-2xs font-700">{i + 1}</span>
                </div>
                <p className="text-xs text-ink-700 font-body leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>

          <div className="divider"/>

          {/* Skill gap bars */}
          <div>
            <p className="label-sm mb-3">Top Missing Skills</p>
            <div className="space-y-3">
              {analytics.top_missing_skills.slice(0, 5).map((sk, i) => {
                const pct = Math.round((sk.frequency / analytics.top_missing_skills[0].frequency) * 100)
                return (
                  <div key={sk.skill}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-600 text-ink-600 capitalize font-body">{sk.skill}</span>
                      <span className="text-2xs font-mono text-ink-400">{sk.frequency}×</span>
                    </div>
                    <AnimatedBar value={pct} color={SKILL_COLORS[i]} delay={i * 100 + 600} height={6}/>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Market Skill Grid */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
        className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-display font-600 text-ink-800">Full Market Demand Report</h3>
            <p className="text-xs text-ink-400 font-body mt-0.5">Current hiring demand scores across technical skills</p>
          </div>
          <span className="badge-indigo text-2xs">{market.length} skills tracked</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {market.map((sk, i) => {
            const pct = Math.round(sk.market_demand_score * 100)
            const level = pct >= 90 ? 'Very High' : pct >= 80 ? 'High' : pct >= 70 ? 'Medium' : 'Low'
            const cfg = pct >= 90
              ? { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' }
              : pct >= 80
              ? { color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' }
              : pct >= 70
              ? { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' }
              : { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' }
            return (
              <motion.div key={sk.skill}
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + i * 0.04 }}
                className={`p-3 rounded-xl border ${cfg.bg} ${cfg.border} text-center`}
              >
                <p className={`font-display font-700 text-2xl ${cfg.color}`}>{pct}%</p>
                <p className="font-mono text-2xs text-ink-600 capitalize mt-1">{sk.skill}</p>
                <p className={`text-2xs font-body mt-0.5 ${cfg.color} opacity-70`}>{level}</p>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
