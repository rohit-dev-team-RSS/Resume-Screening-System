import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { getResumes, generateInterview } from '../services/api'

const TYPE_CFG = {
  technical: { badge: 'badge-indigo', dot: 'bg-indigo-400' },
  behavioral: { badge: 'badge-emerald', dot: 'bg-emerald-400' },
  situational: { badge: 'badge-amber', dot: 'bg-amber-400' },
}
const DIFF_COLOR = { easy: 'text-emerald-600', medium: 'text-amber-600', hard: 'text-rose-600' }

function QuestionCard({ q, index, expanded, onToggle }) {
  const cfg = TYPE_CFG[q.type] || { badge: 'badge-gray', dot: 'bg-ink-300' }
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`card overflow-hidden transition-all duration-200 ${expanded ? 'shadow-md border-indigo-200' : 'hover:shadow-sm hover:border-cream-300'}`}
    >
      <button className="w-full p-5 text-left flex items-start gap-4" onClick={onToggle}>
        <div className="w-8 h-8 rounded-xl bg-cream-100 border border-cream-300 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="font-mono text-2xs font-700 text-ink-400">{String(q.question_number || index + 1).padStart(2, '0')}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`badge ${cfg.badge} text-2xs`}>{q.type}</span>
            <span className="badge-gray text-2xs">{q.category}</span>
            <span className={`text-2xs font-mono font-600 ${DIFF_COLOR[q.difficulty] || 'text-ink-400'}`}>
              ● {q.difficulty}
            </span>
          </div>
          <p className="text-sm font-body text-ink-800 leading-relaxed">{q.question}</p>
        </div>
        <svg className={`w-4 h-4 text-ink-400 shrink-0 transition-transform duration-200 mt-1 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 border-t border-cream-200 space-y-4">
              {q.what_to_look_for && (
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <p className="text-2xs font-mono font-700 text-indigo-500 uppercase tracking-wide mb-1.5">What to Look For</p>
                  <p className="text-sm font-body text-ink-700 leading-relaxed">{q.what_to_look_for}</p>
                </div>
              )}
              {q.sample_answer_framework && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <p className="text-2xs font-mono font-700 text-emerald-600 uppercase tracking-wide mb-1.5">Answer Framework</p>
                  <p className="text-sm font-body text-ink-700">{q.sample_answer_framework}</p>
                </div>
              )}
              {q.follow_up_questions?.length > 0 && (
                <div>
                  <p className="text-2xs font-mono font-700 text-ink-400 uppercase tracking-wide mb-2">Follow-up Questions</p>
                  <div className="space-y-1.5">
                    {q.follow_up_questions.map((fq, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs font-body text-ink-500">
                        <span className="text-amber-500 shrink-0 mt-0.5">→</span>{fq}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function Interview() {
  const [resumes, setResumes] = useState([])
  const [interview, setInterview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const { register, handleSubmit } = useForm({ defaultValues: { difficulty: 'medium', interview_type: 'mixed', num_questions: 10 } })

  useEffect(() => {
    getResumes({ page_size: 20 }).then(r => setResumes((r.data.resumes || []).filter(r => r.status === 'parsed'))).catch(() => {})
  }, [])

  const onSubmit = async (data) => {
    if (!data.resume_id) { toast.error('Select a resume first'); return }
    setLoading(true); setInterview(null)
    try {
      const { data: res } = await generateInterview({ ...data, num_questions: parseInt(data.num_questions) })
      setInterview(res)
      toast.success(`${res.questions.length} questions generated!`)
    } catch (err) { toast.error(err.response?.data?.detail || 'Generation failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6 pb-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="page-title mb-1">Mock Interview Studio</h2>
        <p className="text-sm text-ink-400 font-body">AI-personalized questions based on your resume and target role</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Config */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          className="lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-5 sticky top-20">
            <div className="flex items-center gap-2 pb-4 border-b border-cream-200">
              <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-sm">🎤</div>
              <h3 className="font-display font-600 text-ink-800">Interview Setup</h3>
            </div>

            <div>
              <label className="label">Resume</label>
              <select {...register('resume_id', { required: true })} className="input">
                <option value="">— Select —</option>
                {resumes.map(r => <option key={r.id} value={r.id}>{r.original_filename}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Target Role</label>
              <input {...register('job_title')} placeholder="e.g. Senior Data Engineer" className="input"/>
            </div>

            <div>
              <label className="label">Interview Type</label>
              <select {...register('interview_type')} className="input">
                <option value="mixed">Mixed — Technical + Behavioral</option>
                <option value="technical">Technical Only</option>
                <option value="behavioral">Behavioral (STAR)</option>
                <option value="situational">Situational</option>
              </select>
            </div>

            <div>
              <label className="label">Difficulty Level</label>
              <div className="grid grid-cols-3 gap-2">
                {['easy', 'medium', 'hard'].map(d => {
                  const colors = { easy: 'border-emerald-300 bg-emerald-50 text-emerald-700', medium: 'border-amber-300 bg-amber-50 text-amber-700', hard: 'border-rose-300 bg-rose-50 text-rose-700' }
                  return (
                    <label key={d} className="cursor-pointer">
                      <input {...register('difficulty')} type="radio" value={d} className="sr-only peer"/>
                      <div className={`text-center py-2 rounded-xl border text-xs font-600 font-body capitalize cursor-pointer transition-all
                        peer-checked:${colors[d]} peer-checked:shadow-sm border-cream-300 text-ink-400 hover:border-cream-400`}
                        style={{}}>
                        {d}
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="label">Questions</label>
              <select {...register('num_questions')} className="input">
                {[5, 10, 15, 20, 25].map(n => <option key={n} value={n}>{n} questions (~{n * 4} min)</option>)}
              </select>
            </div>

            <div>
              <label className="label">Job Description <span className="text-ink-300 font-body normal-case">(optional — improves targeting)</span></label>
              <textarea {...register('job_description')} rows={4} placeholder="Paste JD for more relevant questions..."
                className="input resize-none font-mono text-xs"/>
            </div>

            <button type="submit" disabled={loading || resumes.length === 0} className="btn-amber w-full py-3 text-base rounded-2xl">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Generating...
                </span>
              ) : '🎤 Generate Interview'}
            </button>
          </form>
        </motion.div>

        {/* Questions */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
          className="lg:col-span-3 space-y-4">
          {loading ? (
            <div className="card p-16 flex flex-col items-center gap-6">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-4 border-amber-100 border-t-amber-500 animate-spin"/>
                <div className="absolute inset-4 rounded-full border-2 border-indigo-100 border-b-indigo-500 animate-spin" style={{ animationDirection: 'reverse' }}/>
                <div className="absolute inset-0 flex items-center justify-center text-2xl">🎤</div>
              </div>
              <p className="font-display font-600 text-ink-700">Crafting Your Interview...</p>
              <p className="text-sm font-mono text-ink-400 animate-pulse-soft">Personalizing based on your skills and target role</p>
            </div>
          ) : interview ? (
            <>
              {/* Header */}
              <div className="card p-5 flex items-center justify-between bg-gradient-to-r from-amber-50 to-cream-100 border-amber-200">
                <div>
                  <p className="font-display font-600 text-ink-800">{interview.job_title || 'Custom Interview'}</p>
                  <p className="text-xs font-mono text-ink-400 mt-0.5">
                    {interview.questions.length} questions · ~{interview.estimated_duration_minutes} min
                  </p>
                </div>
                <div className="flex gap-2">
                  {['technical', 'behavioral', 'situational'].map(t => {
                    const count = interview.questions.filter(q => q.type === t).length
                    if (!count) return null
                    const cfg = TYPE_CFG[t] || { badge: 'badge-gray' }
                    return <span key={t} className={`badge ${cfg.badge} text-2xs`}>{count} {t}</span>
                  })}
                </div>
              </div>

              {/* Prep Tips */}
              {interview.preparation_tips?.length > 0 && (
                <div className="card p-5">
                  <p className="label-sm mb-3">Preparation Tips</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {interview.preparation_tips.map((tip, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs font-body text-ink-600">
                        <span className="text-emerald-500 shrink-0 mt-0.5">✓</span>{tip}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Questions */}
              <div className="space-y-3">
                {interview.questions.map((q, i) => (
                  <QuestionCard key={i} q={q} index={i}
                    expanded={expanded === i} onToggle={() => setExpanded(expanded === i ? null : i)}/>
                ))}
              </div>
            </>
          ) : (
            <div className="card p-16 flex flex-col items-center text-center gap-5">
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3 }}
                className="w-20 h-20 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center text-4xl">
                🎤
              </motion.div>
              <div>
                <p className="font-display font-600 text-ink-700 text-xl mb-2">Interview Studio Ready</p>
                <p className="text-sm text-ink-400 font-body max-w-xs">Configure your session to generate personalized AI interview questions</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {['Technical', 'Behavioral', 'Situational', 'STAR Framework'].map(t => (
                  <span key={t} className="badge-amber text-2xs">{t}</span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
