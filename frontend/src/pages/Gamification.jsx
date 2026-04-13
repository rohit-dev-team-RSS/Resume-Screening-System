import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { getGamificationProfile, getLeaderboard, getBadgeCatalog } from '../services/interviewApi'
import { useAuth } from '../context/AuthContext'
import { LeaderboardCard, BadgeCard } from '../components/interview/LeaderboardCard'
import ScoreGauge from '../components/interview/ScoreGauge'

const TABS = ['Overview', 'Badges', 'Leaderboard']

function StreakCalendar({ streak }) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const today = new Date().getDay()
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {days.map((day, i) => {
        const isActive = streak >= (i <= today ? today - i + 1 : 8 - i + today)
        return (
          <div key={day} className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-all ${i === today ? 'ring-2 ring-indigo-400 ring-offset-1' : ''} ${isActive ? 'bg-amber-400 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
              {isActive ? '🔥' : '○'}
            </div>
            <span className="text-2xs font-mono text-slate-400">{day.slice(0, 1)}</span>
          </div>
        )
      })}
    </div>
  )
}

function LevelBar({ level_info }) {
  const { level, name, icon, progress_pct, points_to_next } = level_info || {}
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 16, color: '#1E293B' }}>{name}</p>
            <p className="text-xs font-mono text-slate-400">Level {level}</p>
          </div>
        </div>
        {points_to_next > 0 && (
          <p className="text-xs font-mono text-indigo-500">{points_to_next} pts to next level</p>
        )}
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${progress_pct || 0}%` }}
          transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #818CF8, #6366F1)' }}
        />
      </div>
      <p className="text-xs font-mono text-slate-400 text-right">{progress_pct}% to next level</p>
    </div>
  )
}

export default function Gamification() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState(0)
  const [profile, setProfile] = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [badgeCatalog, setBadgeCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [myRank, setMyRank] = useState(null)

  useEffect(() => {
    Promise.all([
      getGamificationProfile().catch(() => ({ data: null })),
      getLeaderboard(30).catch(() => ({ data: { leaderboard: [], my_rank: null } })),
      getBadgeCatalog().catch(() => ({ data: { badges: [] } })),
    ]).then(([p, l, b]) => {
      setProfile(p.data)
      setLeaderboard(l.data?.leaderboard || [])
      setMyRank(l.data?.my_rank)
      setBadgeCatalog(b.data?.badges || [])
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-32 rounded-2xl bg-slate-100 animate-pulse"/>
      ))}
    </div>
  )

  const earnedBadgeIds = new Set((profile?.badges || []).map(b => b.id))

  return (
    <div className="space-y-6 pb-8">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden p-7"
        style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)' }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.3) 1px, transparent 0)', backgroundSize: '24px 24px' }}/>
        <div className="relative flex items-center justify-between flex-wrap gap-5">
          <div>
            <p className="font-mono text-indigo-300 text-xs tracking-widest uppercase mb-2">🏆 Career Achievements</p>
            <h1 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 32, color: 'white', lineHeight: 1.2, marginBottom: 8 }}>
              Your Rewards Hub
            </h1>
            <p className="text-indigo-200 text-sm font-body">Track points, unlock badges, climb the leaderboard</p>
          </div>
          {profile && (
            <div className="flex items-center gap-5">
              <div className="text-center">
                <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 36, color: '#FCD34D' }}>
                  {(profile.total_points || 0).toLocaleString()}
                </p>
                <p className="text-indigo-300 text-xs font-mono">Total Points</p>
              </div>
              <div className="text-center">
                <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 36, color: '#FB923C' }}>
                  {profile.current_streak || 0}🔥
                </p>
                <p className="text-indigo-300 text-xs font-mono">Day Streak</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all font-body ${activeTab === i ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100' : 'text-slate-500 hover:text-slate-800'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 0 && profile && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Level & Progress */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
              <h3 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17, color: '#1E293B' }}>Level Progress</h3>
              <LevelBar level_info={profile.level_info}/>
              <div className="divider"/>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono mb-3">Weekly Streak</p>
                <StreakCalendar streak={profile.current_streak || 0}/>
                <div className="flex items-center gap-4 mt-3">
                  <div>
                    <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 18, color: '#F59E0B' }}>
                      {profile.current_streak || 0} days
                    </p>
                    <p className="text-xs text-slate-400 font-mono">Current streak</p>
                  </div>
                  <div>
                    <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 18, color: '#6366F1' }}>
                      {profile.longest_streak || 0} days
                    </p>
                    <p className="text-xs text-slate-400 font-mono">Best streak</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-3">
              {[
                { icon: '📊', label: 'Interviews', val: profile.total_interviews || 0, color: '#6366F1', bg: '#EEF2FF' },
                { icon: '📝', label: 'Questions', val: profile.total_questions_answered || 0, color: '#10B981', bg: '#ECFDF5' },
                { icon: '🎯', label: 'Avg Score', val: `${Math.round((profile.average_score || 0) * 100)}%`, color: '#F59E0B', bg: '#FFFBEB' },
                { icon: '🛡️', label: 'Clean Sessions', val: profile.clean_sessions || 0, color: '#0EA5E9', bg: '#F0F9FF' },
                { icon: '🏅', label: 'Badges Earned', val: profile.badges?.length || 0, color: '#8B5CF6', bg: '#EDE9FE' },
              ].map(({ icon, label, val, color, bg }) => (
                <motion.div key={label} whileHover={{ scale: 1.02 }}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0" style={{ background: bg }}>
                    {icon}
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-mono">{label}</p>
                    <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 20, color }}>{val}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Recent badges */}
          {profile.badges?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17, color: '#1E293B', marginBottom: 16 }}>
                Recent Badges
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {profile.badges.slice(-6).map((badge, i) => (
                  <BadgeCard key={badge.id} badge={badge} earned earnedAt={badge.earned_at}/>
                ))}
              </div>
            </div>
          )}

          {/* Points history */}
          {profile.recent_points?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17, color: '#1E293B', marginBottom: 12 }}>
                Recent Points Activity
              </h3>
              <div className="space-y-2">
                {profile.recent_points.slice(-10).reverse().map((item, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between py-2.5 px-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm">+</div>
                      <span className="text-sm font-body text-slate-700 capitalize">{item.event?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-indigo-600">+{item.points} pts</span>
                      {item.ts && <span className="text-xs font-mono text-slate-400">{new Date(item.ts).toLocaleDateString()}</span>}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Badges */}
      {activeTab === 1 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 20, color: '#1E293B' }}>Badge Collection</h3>
              <p className="text-sm text-slate-400 font-body mt-0.5">
                {earnedBadgeIds.size} / {badgeCatalog.length} earned
              </p>
            </div>
            <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(earnedBadgeIds.size / Math.max(badgeCatalog.length, 1)) * 100}%` }}/>
            </div>
          </div>

          {/* By tier */}
          {['legendary', 'platinum', 'gold', 'silver', 'bronze'].map(tier => {
            const tierBadges = badgeCatalog.filter(b => b.tier === tier)
            if (!tierBadges.length) return null
            const TIER_COLORS = { legendary: '#7C3AED', platinum: '#0EA5E9', gold: '#F59E0B', silver: '#64748B', bronze: '#92400E' }
            return (
              <div key={tier}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-24 h-px bg-slate-200"/>
                  <span className="text-xs font-bold font-mono uppercase tracking-widest" style={{ color: TIER_COLORS[tier] }}>{tier}</span>
                  <div className="flex-1 h-px bg-slate-200"/>
                </div>
                <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {tierBadges.map(badge => (
                    <BadgeCard
                      key={badge.id} badge={badge}
                      earned={earnedBadgeIds.has(badge.id)}
                      earnedAt={profile?.badges?.find(b => b.id === badge.id)?.earned_at}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tab: Leaderboard */}
      {activeTab === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 20, color: '#1E293B' }}>Global Leaderboard</h3>
              <p className="text-sm text-slate-400 font-body mt-0.5">Top performers by total points</p>
            </div>
            {myRank && (
              <div className="px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-xl">
                <p className="text-xs font-mono text-indigo-500 uppercase tracking-wide">Your Rank</p>
                <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 22, color: '#4F46E5', lineHeight: 1 }}>#{myRank}</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {leaderboard.map((entry, i) => (
              <LeaderboardCard key={entry.user_id} entry={entry} currentUserId={user?.id} index={i}/>
            ))}
            {leaderboard.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <p className="text-4xl mb-3">🏆</p>
                <p className="font-semibold text-slate-600 font-body">No rankings yet</p>
                <p className="text-sm text-slate-400 font-body mt-1">Complete interviews to appear on the leaderboard</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
