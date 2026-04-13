import { motion } from 'framer-motion'

// ── LeaderboardCard ───────────────────────────────────────────────────────────
export function LeaderboardCard({ entry, currentUserId, index }) {
  const isMe = entry.user_id === currentUserId
  const RANK_STYLES = {
    1: { bg: 'bg-amber-50 border-amber-300', badge: 'bg-amber-400 text-white', icon: '🥇' },
    2: { bg: 'bg-slate-50 border-slate-300', badge: 'bg-slate-400 text-white', icon: '🥈' },
    3: { bg: 'bg-orange-50 border-orange-300', badge: 'bg-orange-400 text-white', icon: '🥉' },
  }
  const rankStyle = RANK_STYLES[entry.rank] || { bg: 'bg-white border-slate-200', badge: 'bg-slate-200 text-slate-600', icon: '' }

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200 ${rankStyle.bg} ${isMe ? 'ring-2 ring-indigo-400 ring-offset-1' : 'hover:shadow-sm'}`}
    >
      {/* Rank */}
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${rankStyle.badge}`}>
        {entry.rank <= 3 ? rankStyle.icon : `#${entry.rank}`}
      </div>

      {/* Avatar */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
        {entry.level_info?.icon || '🌱'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm text-slate-800 font-body truncate">
            {isMe ? 'You' : `Player ${entry.user_id.slice(-6)}`}
          </p>
          {isMe && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-mono font-bold">YOU</span>}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-slate-500 font-body">{entry.level_info?.name}</span>
          {entry.current_streak > 0 && (
            <span className="text-xs text-amber-600 font-mono">🔥 {entry.current_streak}d</span>
          )}
          <span className="text-xs text-slate-400 font-mono">{entry.total_interviews} interviews</span>
        </div>
        {/* Level progress bar */}
        <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden w-24">
          <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${entry.level_info?.progress_pct || 0}%` }}/>
        </div>
      </div>

      {/* Points */}
      <div className="text-right shrink-0">
        <p className="font-bold text-indigo-600 font-mono text-base">{entry.total_points.toLocaleString()}</p>
        <p className="text-2xs text-slate-400 font-mono">points</p>
        {entry.top_badge && <span className="text-base">{entry.top_badge.icon}</span>}
      </div>
    </motion.div>
  )
}

// ── InterviewCard ─────────────────────────────────────────────────────────────
export function InterviewCard({ interview, onStart, index }) {
  const diff = interview.difficulty || 'medium'
  const DIFF = {
    easy: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    medium: { color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', badge: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    hard: { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', badge: 'text-rose-600 bg-rose-50 border-rose-200' },
  }[diff]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden group"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-semibold text-slate-800 font-body text-base leading-snug">{interview.job_title}</h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{interview.total_questions} questions · ~{interview.estimated_duration_minutes}min</p>
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-bold font-mono capitalize ${DIFF.badge}`}>
            {diff}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {(interview.candidate_skills || []).slice(0, 4).map(sk => (
            <span key={sk} className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 text-xs font-mono">{sk}</span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {['technical', 'behavioral', 'situational'].map(t => {
            const count = (interview.questions || []).filter(q => q.type === t).length
            if (!count) return null
            return (
              <span key={t} className="text-xs font-mono text-slate-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: t === 'technical' ? '#6366F1' : t === 'behavioral' ? '#10B981' : '#F59E0B' }}/>
                {count} {t.slice(0, 4)}
              </span>
            )
          })}
        </div>
      </div>

      <div className="px-5 pb-5">
        <button onClick={() => onStart(interview)}
          className="w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 group-hover:shadow-md"
          style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)', boxShadow: '0 2px 8px rgba(99,102,241,0.25)' }}>
          Start Interview →
        </button>
      </div>
    </motion.div>
  )
}

// ── BadgeCard ─────────────────────────────────────────────────────────────────
export function BadgeCard({ badge, earned = false, earnedAt }) {
  const TIERS = {
    bronze: 'from-amber-700 to-amber-500',
    silver: 'from-slate-500 to-slate-400',
    gold: 'from-yellow-500 to-amber-400',
    platinum: 'from-cyan-500 to-sky-400',
    legendary: 'from-purple-600 to-indigo-500',
  }
  const gradient = TIERS[badge.tier] || TIERS.bronze

  return (
    <motion.div
      whileHover={{ scale: earned ? 1.04 : 1 }}
      className={`relative p-4 rounded-2xl border text-center transition-all duration-200 ${earned ? 'bg-white border-indigo-200 shadow-sm cursor-default' : 'bg-slate-50 border-slate-200 opacity-50'}`}
    >
      {earned && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
          <span className="text-white text-2xs">✓</span>
        </div>
      )}
      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mx-auto mb-3 text-2xl shadow-sm ${!earned ? 'grayscale' : ''}`}>
        {badge.icon}
      </div>
      <p className="font-semibold text-slate-800 text-sm font-body leading-tight mb-1">{badge.name}</p>
      <p className="text-xs text-slate-500 font-body leading-snug mb-2">{badge.description}</p>
      <div className="flex items-center justify-center gap-1">
        <span className="text-xs font-mono font-bold text-indigo-600">+{badge.points}</span>
        <span className="text-xs text-slate-400 font-mono">pts</span>
      </div>
      {earned && earnedAt && (
        <p className="text-2xs text-slate-400 font-mono mt-1">{new Date(earnedAt).toLocaleDateString()}</p>
      )}
    </motion.div>
  )
}
