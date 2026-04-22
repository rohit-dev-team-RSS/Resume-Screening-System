import { motion } from 'framer-motion'
import { useState } from 'react'
import toast from 'react-hot-toast'
import ScoreRing from '../ScoreRing'
import GithubHoverCard from './GithubHoverCard'
import { downloadResume } from '../../services/api'

// Score label
function scoreLabel(score) {
  if (score >= 0.80) return 'Strong Match ✅'
  if (score >= 0.60) return 'Good Match 👍'
  if (score >= 0.40) return 'Partial Match 🔶'
  return 'Poor Match ⚠️'
}

function scoreColor(score) {
  if (score >= 0.80) return '#10B981'
  if (score >= 0.60) return '#6366F1'
  if (score >= 0.40) return '#F59E0B'
  return '#F43F5E'
}

export default function CandidateCard({ candidate, rank }) {
  const [loadingDownload, setLoadingDownload] = useState(false)

  const handleDownload = async () => {
    setLoadingDownload(true)
    try {
      const response = await downloadResume(candidate.resume_id)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = candidate.filename || `resume-${candidate.name || 'candidate'}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Resume downloaded')
    } catch {
      toast.error('Download failed')
    } finally {
      setLoadingDownload(false)
    }
  }

  const score = candidate.final_score || 0
  const recColor = scoreColor(score)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
    >
      <div className="flex items-start gap-4">
        {/* Rank badge */}
        <div className="flex-shrink-0 mt-1 w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-sm shadow-lg">
          #{rank}
        </div>

        {/* Avatar/Name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-500 font-semibold text-lg flex-shrink-0">
              {candidate.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-slate-900 text-base truncate">{candidate.name || 'Anonymous'}</h3>
              <p className="text-sm text-slate-500 flex items-center gap-1">
                {candidate.location || 'N/A'} • {candidate.experience_years || 0} yrs • 
                <span className="font-mono text-xs text-slate-400">{candidate.email}</span>
              </p>
            </div>
          </div>

          {/* Score */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-shrink-0">
              <ScoreRing score={score} size={80} />
            </div>
            <div>
              <div className="font-bold text-2xl" style={{ color: recColor }}>
                {Math.round(score * 100)}%
              </div>
              <div className="text-sm font-semibold text-slate-600">{scoreLabel(score)}</div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 mb-4 text-xs text-slate-500 font-mono">
            <div className="text-center p-2 rounded-lg bg-slate-50">
              <div className="font-bold text-indigo-600">{candidate.matched_skills?.length || 0}</div>
              Matched Skills
            </div>
            <div className="text-center p-2 rounded-lg bg-slate-50">
              <div className="font-bold text-orange-600">{candidate.missing_skills?.length || 0}</div>
              Missing
            </div>
            <div className="text-center p-2 rounded-lg bg-slate-50">
              <div className="font-bold text-emerald-600">{candidate.rank}</div>
              Rank
            </div>
          </div>

          {/* Top skills */}
          {(candidate.matched_skills || []).length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Key Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {candidate.skills?.slice(0, 8).map(skill => (
                  <span key={skill} className="px-2 py-1 rounded-full text-xs bg-emerald-100 text-emerald-700 font-medium">
                    {skill}
                  </span>
                ))}
                {(candidate.skills || []).length > 8 && (
                  <span className="px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-500 font-medium">
                    +{(candidate.skills.length - 8)} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* GitHub */}
          {candidate.github_username && (
            <div className="mb-4">
              <GithubHoverCard username={candidate.github_username} />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <motion.button
              onClick={handleDownload}
              disabled={loadingDownload}
              whileHover={{ scale: 1.02 }}
              className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-2 px-4 rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loadingDownload ? '⏳ Downloading...' : '⬇ Download Resume'}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              className="w-11 h-11 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200"
              title="Shortlist for interview"
            >
              ⭐
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

