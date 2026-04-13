import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

const TIP = {
  contentStyle: {
    background: '#fff', border: '1px solid #EAE7DF', borderRadius: '12px',
    fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: '12px', color: '#1C1C28',
    boxShadow: '0 8px 24px rgba(15,15,20,0.10)', padding: '10px 14px',
  },
  cursor: { fill: 'rgba(99,102,241,0.04)' },
}

// Score Trend — Area Chart
export function ScoreTrendChart({ data = [] }) {
  const formatted = data.map(d => ({ ...d, score: Math.round((d.score || 0) * 100) }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity={0.2}/>
            <stop offset="100%" stopColor="#6366F1" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="#F4F2ED" vertical={false}/>
        <XAxis dataKey="date" tick={{ fill: '#9E9EAA', fontSize: 11, fontFamily: '"Plus Jakarta Sans"' }} tickLine={false} axisLine={false}/>
        <YAxis domain={[0, 100]} tick={{ fill: '#9E9EAA', fontSize: 11, fontFamily: '"Plus Jakarta Sans"' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`}/>
        <Tooltip {...TIP} formatter={v => [`${v}%`, 'ATS Score']} labelStyle={{ color: '#5E5E6A', fontWeight: 600, marginBottom: 4 }}/>
        <Area type="monotone" dataKey="score" stroke="#6366F1" strokeWidth={2.5} fill="url(#scoreGrad)"
          dot={{ fill: '#fff', stroke: '#6366F1', strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, fill: '#6366F1', stroke: '#fff', strokeWidth: 2 }}/>
      </AreaChart>
    </ResponsiveContainer>
  )
}

// Market Demand — Horizontal Bar
export function SkillDemandChart({ data = [] }) {
  const d = data.slice(0, 10).map(s => ({ skill: s.skill, demand: Math.round((s.market_demand_score || 0) * 100) }))
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={d} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
        <defs>
          <linearGradient id="demandGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#818CF8"/>
            <stop offset="100%" stopColor="#6366F1"/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="#F4F2ED" horizontal={false}/>
        <XAxis type="number" domain={[0, 100]} tick={{ fill: '#9E9EAA', fontSize: 11, fontFamily: '"Plus Jakarta Sans"' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`}/>
        <YAxis type="category" dataKey="skill" width={80} tick={{ fill: '#5E5E6A', fontSize: 11, fontFamily: '"Plus Jakarta Sans"' }} tickLine={false} axisLine={false}/>
        <Tooltip {...TIP} formatter={v => [`${v}%`, 'Demand']}/>
        <Bar dataKey="demand" fill="url(#demandGrad)" radius={[0, 6, 6, 0]} maxBarSize={16}/>
      </BarChart>
    </ResponsiveContainer>
  )
}

// Distribution — Donut Pie
export function DistributionPie({ data }) {
  const PALETTE = ['#10B981', '#6366F1', '#F59E0B', '#F43F5E']
  const chartData = [
    { name: 'Strong ≥80%', value: data?.strong_matches || 0 },
    { name: 'Good 60-79%', value: data?.good_matches || 0 },
    { name: 'Partial 40-59%', value: 0 },
    { name: 'Poor <40%', value: data?.poor_matches || 0 },
  ].filter(d => d.value > 0)

  if (chartData.length === 0) return (
    <div className="h-48 flex items-center justify-center text-ink-400 text-sm font-body">
      Run ATS checks to see distribution
    </div>
  )
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" innerRadius={52} outerRadius={80}
          paddingAngle={3} dataKey="value" strokeWidth={0}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]}/>
          ))}
        </Pie>
        <Tooltip {...TIP}/>
        <Legend iconType="circle" iconSize={8}
          wrapperStyle={{ fontFamily: '"Plus Jakarta Sans"', fontSize: '11px', color: '#7C7C88', paddingTop: 8 }}/>
      </PieChart>
    </ResponsiveContainer>
  )
}

// Missing Skills — Vertical Bar
export function MissingSkillsChart({ data = [] }) {
  const d = data.slice(0, 8).map(s => ({ skill: s.skill, count: s.frequency || s.demand_count || 0 }))
  const COLORS = ['#F43F5E', '#F59E0B', '#8B5CF6', '#6366F1', '#0EA5E9', '#10B981', '#FB923C', '#EC4899']
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={d} margin={{ top: 4, right: 8, left: -20, bottom: 40 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="#F4F2ED" vertical={false}/>
        <XAxis dataKey="skill" tick={{ fill: '#5E5E6A', fontSize: 10, fontFamily: '"Plus Jakarta Sans"' }} tickLine={false} axisLine={false} angle={-35} textAnchor="end" interval={0}/>
        <YAxis tick={{ fill: '#9E9EAA', fontSize: 11 }} tickLine={false} axisLine={false}/>
        <Tooltip {...TIP} formatter={v => [v, 'Missing frequency']}/>
        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={36}>
          {d.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// Skills Radar
export function SkillRadarChart({ data = [] }) {
  const d = data.slice(0, 7).map(s => ({ skill: (s.skill || '').slice(0, 10), demand: Math.round((s.market_demand_score || 0) * 100) }))
  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={d} margin={{ top: 10, right: 40, bottom: 10, left: 40 }}>
        <PolarGrid stroke="#EAE7DF" gridType="polygon"/>
        <PolarAngleAxis dataKey="skill" tick={{ fill: '#7C7C88', fontSize: 10, fontFamily: '"Plus Jakarta Sans"' }}/>
        <Radar name="Demand" dataKey="demand" stroke="#6366F1" fill="#6366F1" fillOpacity={0.12} strokeWidth={2} dot={{ fill: '#6366F1', r: 3 }}/>
        <Tooltip {...TIP} formatter={v => [`${v}%`, 'Market Demand']}/>
      </RadarChart>
    </ResponsiveContainer>
  )
}
