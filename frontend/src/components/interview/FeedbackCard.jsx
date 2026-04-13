import { motion } from 'framer-motion'
import ScoreGauge from './ScoreGauge'

export default function FeedbackCard({ feedback, question, questionNumber, onNext, isLast }) {
  if (!feedback) return null

  const score = feedback.score || 0
  const criteriaScores = feedback.criteria_scores || {}

  const COLOR = score >= 8 ? '#10B981' : score >= 6 ? '#6366F1' : score >= 4 ? '#F59E0B' : '#F43F5E'
  const BG = score >= 8 ? 'from-emerald-50 to-white' : score >= 6 ? 'from-indigo-50 to-white' : score >= 4 ? 'from-amber-50 to-white' : 'from-rose-50 to-white'
  const BORDER = score >= 8 ? 'border-emerald-200' : score >= 6 ? 'border-indigo-200' : score >= 4 ? 'border-amber-200' : 'border-rose-200'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-2xl border ${BORDER} bg-gradient-to-br ${BG} overflow-hidden shadow-lg`}
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 font-mono">
                Q{questionNumber}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold`}
                style={{ background: `${COLOR}15`, color: COLOR }}>
                {feedback.grade || 'N/A'}
              </span>
              {feedback.speed_bonus && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                  ⚡ Speed Bonus +{feedback.bonus_points}pts
                </span>
              )}
            </div>
            <p className="font-body text-sm text-slate-600 line-clamp-2">{question}</p>
          </div>
          <ScoreGauge score={score} maxScore={10} size={100} label="Score" showGrade={false}/>
        </div>
      </div>

      {/* Confidence & Points */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wide">Confidence</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full`}
            style={{ background: feedback.confidence_level === 'high' ? '#ECFDF5' : feedback.confidence_level === 'medium' ? '#EEF2FF' : '#FFF1F2', color: feedback.confidence_level === 'high' ? '#059669' : feedback.confidence_level === 'medium' ? '#4F46E5' : '#E11D48' }}>
            {feedback.confidence_level || 'medium'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wide">Points Earned</span>
          <span className="text-sm font-bold text-indigo-600 font-mono">+{feedback.points_earned || 0}</span>
        </div>
      </div>

      <div className="px-6 py-4 space-y-5">
        {/* Criteria scores */}
        {Object.keys(criteriaScores).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest font-mono mb-3">Detailed Scores</p>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(criteriaScores).map(([key, val]) => {
                const pct = Math.round((val / 10) * 100)
                const c = pct >= 70 ? '#10B981' : pct >= 50 ? '#6366F1' : '#F59E0B'
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-600 capitalize font-body">{key.replace(/_/g, ' ')}</span>
                      <span className="font-mono font-bold" style={{ color: c }}>{val}/10</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full rounded-full"
                        style={{ background: c }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Strengths */}
        {feedback.strengths?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-widest font-mono mb-2">✓ Strengths</p>
            <div className="space-y-1.5">
              {feedback.strengths.map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                  className="flex items-start gap-2 text-sm font-body text-slate-700">
                  <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-emerald-600 text-2xs">✓</span>
                  </div>
                  {s}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Weaknesses */}
        {feedback.weaknesses?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-rose-500 uppercase tracking-widest font-mono mb-2">Areas to Improve</p>
            <div className="space-y-1.5">
              {feedback.weaknesses.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-sm font-body text-slate-700">
                  <div className="w-4 h-4 rounded-full bg-rose-50 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-rose-400 text-2xs">→</span>
                  </div>
                  {w}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Improved Answer */}
        {feedback.improved_answer && (
          <div>
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest font-mono mb-2">💡 Model Answer</p>
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
              <p className="text-sm font-body text-indigo-900 leading-relaxed">{feedback.improved_answer}</p>
            </div>
          </div>
        )}

        {/* Coach feedback */}
        {feedback.detailed_feedback && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-start gap-3">
            <span className="text-xl shrink-0">🧑‍💼</span>
            <p className="text-sm font-body text-amber-900 leading-relaxed">{feedback.detailed_feedback}</p>
          </div>
        )}

        {/* Missing concepts */}
        {feedback.key_missing_concepts?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-mono text-slate-400 self-center">Missing:</span>
            {feedback.key_missing_concepts.map((c, i) => (
              <span key={i} className="px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono">{c}</span>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-6 pb-6">
        <button onClick={onNext}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 text-white hover:-translate-y-0.5 active:translate-y-0"
          style={{ background: isLast ? 'linear-gradient(135deg, #10B981, #059669)' : `linear-gradient(135deg, ${COLOR}, ${COLOR}CC)`, boxShadow: `0 4px 12px ${COLOR}30` }}>
          {isLast ? '🏆 View Final Results' : 'Next Question →'}
        </button>
      </div>
    </motion.div>
  )
}
