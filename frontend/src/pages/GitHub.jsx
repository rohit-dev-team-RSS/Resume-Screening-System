import { useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { analyzeGitHub } from '../services/api'
import ScoreRing from '../components/ScoreRing'
import { AnimatedBar } from '../components/AnimatedNumber'

const LANG_COLORS = { Python: '#3572A5', JavaScript: '#F7DF1E', TypeScript: '#2B7489', Go: '#00ADD8', Rust: '#DEA584', Java: '#B07219', Ruby: '#701516', 'C++': '#F34B7D', Swift: '#FA7343', Kotlin: '#A97BFF', Shell: '#89E051', CSS: '#563D7C', HTML: '#E34C26' }

export default function GitHub() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const analyze = async () => {
    if (!username.trim()) { toast.error('Enter a GitHub username'); return }
    setLoading(true); setResult(null)
    try {
      const { data } = await analyzeGitHub({ username: username.trim() })
      setResult(data.data || data); toast.success(`Analyzed @${username}`)
    } catch (err) { toast.error(err.response?.data?.detail || 'Analysis failed — check username or rate limit') }
    finally { setLoading(false) }
  }

  const langs = result?.languages || {}
  const maxLang = Math.max(...Object.values(langs), 1)
  const hirability = result?.hirability_signals || {}

  return (
    <div className="space-y-6 pb-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="page-title mb-1">GitHub Analysis</h2>
        <p className="text-sm text-ink-400 font-body">Repository analysis, tech stack detection, contribution scoring & hirability signals</p>
      </motion.div>

      {/* Search */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="card p-6">
        <div className="flex gap-3 max-w-lg">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-ink-400 text-sm">@</span>
            <input className="input pl-9 font-mono" placeholder="github-username" value={username}
              onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && analyze()}/>
          </div>
          <button onClick={analyze} disabled={loading} className="btn-primary px-6 shrink-0">
            {loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
            )}
            <span>{loading ? 'Analyzing...' : 'Analyze'}</span>
          </button>
        </div>
        <p className="text-xs text-ink-400 font-mono mt-2">Set GITHUB_TOKEN in backend .env to avoid rate limits</p>
      </motion.div>

      {loading && (
        <div className="card p-14 flex flex-col items-center gap-5">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"/>
            <div className="absolute inset-0 flex items-center justify-center text-2xl">🐙</div>
          </div>
          <p className="font-display font-600 text-ink-700">Fetching GitHub Data</p>
          <p className="text-sm font-mono text-ink-400 animate-pulse-soft">Analyzing repos, languages, contributions...</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-5">
          {/* Profile Header */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="card p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-mesh opacity-60 pointer-events-none"/>
            <div className="relative flex flex-wrap items-start gap-5">
              {result.profile?.avatar_url && (
                <img src={result.profile.avatar_url} alt="avatar" className="w-16 h-16 rounded-2xl border border-cream-300 shadow-sm shrink-0"/>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display font-700 text-ink-900 text-2xl">{result.profile?.name || result.username}</h3>
                    <a href={result.profile?.github_url} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-sm text-indigo-600 hover:text-indigo-800 transition-colors">@{result.username} ↗</a>
                    {result.profile?.bio && <p className="text-sm font-body text-ink-500 mt-2 max-w-md">{result.profile.bio}</p>}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {result.profile?.location && <span className="badge-gray text-2xs">📍 {result.profile.location}</span>}
                      {result.profile?.company && <span className="badge-gray text-2xs">🏢 {result.profile.company}</span>}
                      {result.profile?.account_age_years > 0 && <span className="badge-indigo text-2xs">{result.profile.account_age_years}y on GitHub</span>}
                      {result.activity_level && (
                        <span className={`badge text-2xs ${result.activity_level === 'very_active' ? 'badge-emerald' : result.activity_level === 'active' ? 'badge-indigo' : 'badge-gray'}`}>
                          {result.activity_level.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <ScoreRing score={result.contribution_score || 0} size={100} label="Contribution"/>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Public Repos', val: result.profile?.public_repos || 0, color: 'text-indigo-700', bg: 'bg-indigo-50' },
              { label: 'Followers', val: result.profile?.followers || 0, color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'Languages', val: Object.keys(langs).length, color: 'text-amber-700', bg: 'bg-amber-50' },
              { label: 'Tech Stack', val: result.tech_stack?.length || 0, color: 'text-sky-700', bg: 'bg-sky-50' },
            ].map(({ label, val, color, bg }, i) => (
              <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="card p-4 text-center">
                <div className={`w-10 h-10 rounded-xl ${bg} mx-auto flex items-center justify-center mb-2`}/>
                <p className="label-sm mb-1">{label}</p>
                <p className={`font-display font-700 text-3xl ${color}`}>{val.toLocaleString()}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Languages */}
            <div className="card p-5">
              <p className="label-sm mb-4">Language Distribution</p>
              <div className="space-y-3">
                {Object.entries(langs).slice(0, 8).map(([lang, count], i) => {
                  const pct = Math.round((count / maxLang) * 100)
                  const color = LANG_COLORS[lang] || '#6366F1'
                  return (
                    <div key={lang}>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-xs font-600 font-body text-ink-700 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }}/>
                          {lang}
                        </span>
                        <span className="text-2xs font-mono text-ink-400">{count} repos</span>
                      </div>
                      <AnimatedBar value={pct} color={color} delay={i * 80} height={7}/>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Hirability */}
            <div className="card p-5">
              <p className="label-sm mb-4">Hirability Signals</p>
              <div className="space-y-2.5">
                {[
                  { label: 'Has READMEs in repos', key: 'has_readme' },
                  { label: 'Recently active (2024)', key: 'active_recently' },
                  { label: 'Uses multiple languages', key: 'multiple_languages' },
                  { label: 'Has popular projects', key: 'popular_projects' },
                  { label: 'Collaboration signals (forks)', key: 'collaboration_indicator' },
                ].map(({ label, key }) => {
                  const val = hirability[key]
                  return (
                    <div key={key} className={`flex items-center gap-3 p-3 rounded-xl border ${val ? 'bg-emerald-50 border-emerald-200' : 'bg-cream-100 border-cream-200'}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${val ? 'bg-emerald-200' : 'bg-cream-300'}`}>
                        <span className={`text-2xs font-700 ${val ? 'text-emerald-700' : 'text-ink-400'}`}>{val ? '✓' : '○'}</span>
                      </div>
                      <span className="text-xs font-body text-ink-600 flex-1">{label}</span>
                      <span className={`text-2xs font-mono ${val ? 'text-emerald-600' : 'text-ink-400'}`}>{val ? 'Yes' : 'No'}</span>
                    </div>
                  )
                })}
                {hirability.open_source_score !== undefined && (
                  <div className="mt-3 pt-3 border-t border-cream-200">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs font-600 font-body text-ink-700">Open Source Score</span>
                      <span className="text-xs font-mono text-emerald-600 font-700">{Math.round(hirability.open_source_score * 100)}%</span>
                    </div>
                    <AnimatedBar value={Math.round(hirability.open_source_score * 100)} color="#10B981" height={8}/>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top Repos */}
          {result.top_repositories?.length > 0 && (
            <div className="card p-5">
              <p className="label-sm mb-4">Top Repositories</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {result.top_repositories.slice(0, 6).map((repo, i) => (
                  <motion.a key={repo.name} href={repo.url} target="_blank" rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                    className="p-4 rounded-xl bg-cream-100 border border-cream-300 hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-sm transition-all block group">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-600 text-sm text-ink-800 group-hover:text-indigo-700 transition-colors truncate">{repo.name}</p>
                      <span className="text-xs font-mono text-amber-600 shrink-0 ml-2">★ {repo.stars}</span>
                    </div>
                    {repo.description && <p className="text-xs font-body text-ink-500 line-clamp-2 mb-2">{repo.description}</p>}
                    {repo.language && <span className="badge-gray text-2xs">{repo.language}</span>}
                  </motion.a>
                ))}
              </div>
            </div>
          )}

          {/* Insights */}
          {result.insights?.length > 0 && (
            <div className="card p-5">
              <p className="label-sm mb-3">AI Insights</p>
              <div className="space-y-2">
                {result.insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm font-body text-ink-600">
                    <span className="text-indigo-500 shrink-0 mt-0.5">→</span>{insight}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!result && !loading && (
        <div className="card p-16 flex flex-col items-center text-center gap-5">
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3 }}
            className="w-20 h-20 rounded-3xl bg-cream-200 flex items-center justify-center text-4xl">🐙</motion.div>
          <div>
            <p className="font-display font-600 text-ink-700 text-xl mb-2">GitHub Profile Analyzer</p>
            <p className="text-sm text-ink-400 font-body max-w-xs">Enter any GitHub username to analyze their repositories, tech stack, and hirability signals</p>
          </div>
        </div>
      )}
    </div>
  )
}
