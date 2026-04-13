import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const TYPE_CONFIG = {
  technical:   { color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE', icon: '⚙️', hint: 'Demonstrate technical depth, practical experience, and knowledge of edge cases.' },
  behavioral:  { color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0', icon: '💬', hint: 'Use the STAR method: Situation → Task → Action → Result.' },
  situational: { color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', icon: '🔍', hint: 'Think out loud. Walk through your reasoning and decision-making process.' },
}

const DIFF_CONFIG = {
  easy:   { label: 'Entry Level', color: '#10B981', bg: '#ECFDF5' },
  medium: { label: 'Mid Level',   color: '#6366F1', bg: '#EEF2FF' },
  hard:   { label: 'Senior Level',color: '#F43F5E', bg: '#FFF1F2' },
}

export default function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  showIdealAnswer = false,
  showHints = true,
  animationKey,
}) {
  const [hintVisible, setHintVisible] = useState(false)
  const [idealVisible, setIdealVisible] = useState(false)
  const typeCfg = TYPE_CONFIG[question?.type] || TYPE_CONFIG.technical
  const diffCfg = DIFF_CONFIG[question?.difficulty] || DIFF_CONFIG.medium

  return (
    <motion.div
      key={animationKey}
      initial={{ opacity: 0, x: 40, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -40, scale: 0.98 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden"
    >
      {/* Progress strip */}
      <div className="h-1.5 bg-slate-100 relative overflow-hidden">
        <motion.div
          initial={{ width: `${((questionNumber - 1) / totalQuestions) * 100}%` }}
          animate={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: 'linear-gradient(90deg, #818CF8, #6366F1)' }}
        />
      </div>

      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Question number badge */}
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: `linear-gradient(135deg, ${typeCfg.color}, ${typeCfg.color}99)` }}>
            {String(questionNumber).padStart(2, '0')}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-widest font-mono"
                style={{ color: typeCfg.color }}>
                {typeCfg.icon} {question?.type}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-xs font-medium text-slate-500 font-body">{question?.category}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full font-mono"
            style={{ background: diffCfg.bg, color: diffCfg.color }}>
            {diffCfg.label}
          </span>
          <span className="text-xs font-mono text-slate-400">{questionNumber}/{totalQuestions}</span>
        </div>
      </div>

      {/* Question text */}
      <div className="p-6">
        <motion.p
          key={question?.question}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 600,
            fontSize: 19,
            color: '#0F172A',
            lineHeight: 1.55,
          }}
        >
          {question?.question}
        </motion.p>

        {/* What to look for (interviewer info) */}
        {question?.what_to_look_for && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="mt-4 p-3.5 rounded-xl border text-xs font-body leading-relaxed"
            style={{ background: `${typeCfg.bg}`, borderColor: typeCfg.border, color: typeCfg.color }}>
            <span className="font-bold uppercase tracking-wide text-2xs font-mono block mb-1">Evaluate for</span>
            {question.what_to_look_for}
          </motion.div>
        )}

        {/* STAR hint for behavioral */}
        {question?.type === 'behavioral' && (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {['Situation', 'Task', 'Action', 'Result'].map((s, i) => (
              <div key={s} className="text-center p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="font-bold text-sm text-emerald-700 font-mono">{s[0]}</div>
                <div className="text-2xs text-emerald-600 font-body mt-0.5">{s}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Collapsible hints */}
      {showHints && (
        <div className="px-6 pb-4 space-y-2">
          <button
            onClick={() => setHintVisible(h => !h)}
            className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-indigo-600 transition-colors group"
          >
            <span className={`transition-transform duration-200 ${hintVisible ? 'rotate-90' : ''}`}>▶</span>
            <span className="group-hover:underline">Answer Strategy</span>
          </button>
          <AnimatePresence>
            {hintVisible && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-100 text-sm font-body text-amber-800 leading-relaxed">
                  💡 {typeCfg.hint}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Follow-up preview */}
          {question?.follow_up_questions?.length > 0 && (
            <>
              <button
                onClick={() => setIdealVisible(h => !h)}
                className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-indigo-600 transition-colors group"
              >
                <span className={`transition-transform duration-200 ${idealVisible ? 'rotate-90' : ''}`}>▶</span>
                <span className="group-hover:underline">Possible Follow-ups ({question.follow_up_questions.length})</span>
              </button>
              <AnimatePresence>
                {idealVisible && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1.5 pt-1">
                      {question.follow_up_questions.map((fq, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs font-body text-slate-600 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                          <span className="text-indigo-400 shrink-0 mt-0.5">→</span>{fq}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      )}

      {/* Time limit indicator */}
      {question?.time_limit_seconds && (
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>⏱</span>
            <span>Suggested: {Math.floor(question.time_limit_seconds / 60)}m {question.time_limit_seconds % 60}s</span>
          </div>
        </div>
      )}
    </motion.div>
  )
}
