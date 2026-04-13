import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { getResumes, enhanceResume } from '../services/api'

export default function Enhance() {
  const [resumes, setResumes] = useState([])
  const [form, setForm] = useState({ resume_id: '', target_role: '', tone: 'professional', job_description: '' })
  const [areas, setAreas] = useState({ summary: true, experience: true, skills: true, keywords: true, formatting: false })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    getResumes({ page_size: 20 }).then(r => setResumes((r.data.resumes || []).filter(r => r.status === 'parsed'))).catch(() => {})
  }, [])

  const run = async () => {
    if (!form.resume_id) { toast.error('Select a resume'); return }
    setLoading(true); setResult(null)
    try {
      const { data } = await enhanceResume({ ...form, enhancement_areas: Object.keys(areas).filter(k => areas[k]) })
      setResult(data); toast.success(`Enhanced! +${Math.round(data.ats_improvement_estimate * 100)}% estimated`)
    } catch (err) { toast.error(err.response?.data?.detail || 'Enhancement failed') }
    finally { setLoading(false) }
  }

  const tones = ['professional', 'creative', 'academic']
  const AREA_ICONS = { summary: '📝', experience: '💼', skills: '🛠', keywords: '🔑', formatting: '✏️' }

  return (
    <div className="space-y-6 pb-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="page-title mb-1">AI Resume Enhancer</h2>
        <p className="text-sm text-ink-400 font-body">LLM-powered improvements — stronger language, keyword injection, ATS optimization</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Config */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          className="lg:col-span-2">
          <div className="card p-6 space-y-5 sticky top-20">
            <div className="flex items-center gap-2 pb-4 border-b border-cream-200">
              <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center text-sm">✨</div>
              <h3 className="font-display font-600 text-ink-800">Enhancement Config</h3>
            </div>

            <div>
              <label className="label">Resume</label>
              <select className="input" value={form.resume_id} onChange={e => setForm(f => ({ ...f, resume_id: e.target.value }))}>
                <option value="">— Select —</option>
                {resumes.map(r => <option key={r.id} value={r.id}>{r.original_filename}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Target Role</label>
              <input className="input" placeholder="e.g. Senior ML Engineer" value={form.target_role}
                onChange={e => setForm(f => ({ ...f, target_role: e.target.value }))}/>
            </div>

            <div>
              <label className="label">Writing Tone</label>
              <div className="grid grid-cols-3 gap-2">
                {tones.map(t => (
                  <button key={t} type="button"
                    onClick={() => setForm(f => ({ ...f, tone: t }))}
                    className={`py-2 rounded-xl border text-xs font-600 font-body capitalize transition-all ${form.tone === t ? 'bg-violet-50 border-violet-300 text-violet-700 shadow-sm' : 'border-cream-300 text-ink-400 hover:border-cream-400'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Enhancement Areas</label>
              <div className="space-y-2.5">
                {Object.keys(areas).map(area => (
                  <label key={area} className="flex items-center gap-3 cursor-pointer group p-2 rounded-xl hover:bg-cream-100 transition-colors">
                    <div className="relative shrink-0">
                      <input type="checkbox" checked={areas[area]} onChange={() => setAreas(a => ({ ...a, [area]: !a[area] }))} className="sr-only peer"/>
                      <div className="w-4 h-4 rounded border-2 border-cream-300 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all"/>
                      {areas[area] && (
                        <svg className="absolute inset-0 w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                      )}
                    </div>
                    <span className="text-sm font-body text-ink-600 capitalize flex items-center gap-2">
                      <span>{AREA_ICONS[area]}</span>{area}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Job Description <span className="text-ink-300 font-body normal-case">(for keyword targeting)</span></label>
              <textarea className="input resize-none font-mono text-xs" rows={5}
                placeholder="Paste JD for better keyword injection..."
                value={form.job_description} onChange={e => setForm(f => ({ ...f, job_description: e.target.value }))}/>
            </div>

            <button onClick={run} disabled={loading || resumes.length === 0}
              className="btn w-full py-3 text-base rounded-2xl text-white font-600"
              style={{ background: loading ? '#C4B5FD' : 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Enhancing...
                </span>
              ) : '✨ Enhance My Resume'}
            </button>
          </div>
        </motion.div>

        {/* Results */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
          className="lg:col-span-3 space-y-5">
          {loading ? (
            <div className="card p-16 flex flex-col items-center gap-6">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-4 border-violet-100 border-t-violet-500 animate-spin"/>
                <div className="absolute inset-3 rounded-full border-2 border-indigo-100 border-b-indigo-400 animate-spin" style={{ animationDirection: 'reverse' }}/>
                <div className="absolute inset-0 flex items-center justify-center text-2xl">✨</div>
              </div>
              <div className="text-center">
                <p className="font-display font-600 text-ink-700 text-lg">AI is Enhancing Your Resume</p>
                <p className="text-sm font-mono text-ink-400 mt-2 animate-pulse-soft">Applying LLM improvements...</p>
              </div>
            </div>
          ) : result ? (
            <>
              {/* Improvement banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-50 to-cream-100 border border-emerald-200 flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                  <span className="font-display font-700 text-emerald-700 text-xl">+{Math.round(result.ats_improvement_estimate * 100)}%</span>
                </div>
                <div>
                  <p className="font-display font-600 text-emerald-800">Resume Enhanced Successfully ✨</p>
                  <p className="text-sm font-body text-emerald-600 mt-0.5">
                    {result.added_keywords?.length || 0} keywords added · Estimated ATS improvement: {Math.round(result.ats_improvement_estimate * 100)}%
                  </p>
                </div>
              </div>

              {/* Notes */}
              {result.enhancement_notes?.length > 0 && (
                <div className="card p-5">
                  <p className="label-sm mb-3">What Was Enhanced</p>
                  {result.enhancement_notes.map((n, i) => (
                    <p key={i} className="text-sm font-body text-ink-600 mb-2 flex items-start gap-2">
                      <span className="text-emerald-500 shrink-0">✓</span>{n}
                    </p>
                  ))}
                </div>
              )}

              {/* Summary diff */}
              {(result.original_summary || result.enhanced_summary) && (
                <div className="card p-5">
                  <p className="label-sm mb-4">Summary — Before vs After</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                      <p className="text-2xs font-mono font-700 text-rose-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-400"/>Original
                      </p>
                      <p className="text-xs font-body text-ink-600 leading-relaxed">{result.original_summary || 'No summary found'}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                      <p className="text-2xs font-mono font-700 text-emerald-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"/>AI Enhanced
                      </p>
                      <p className="text-xs font-body text-ink-600 leading-relaxed">{result.enhanced_summary || '—'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Keywords */}
              {result.added_keywords?.length > 0 && (
                <div className="card p-5">
                  <p className="label-sm mb-3">Keywords to Incorporate</p>
                  <div className="flex flex-wrap gap-2">
                    {result.added_keywords.map(k => (
                      <span key={k} className="badge-emerald text-xs">+ {k}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Formatting */}
              {result.formatting_suggestions?.length > 0 && (
                <div className="card p-5">
                  <p className="label-sm mb-3">Formatting Suggestions</p>
                  <div className="space-y-2">
                    {result.formatting_suggestions.map((s, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <span className="text-amber-500 shrink-0 mt-0.5 text-sm">→</span>
                        <p className="text-xs font-body text-ink-700 leading-relaxed">{s}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card p-16 flex flex-col items-center text-center gap-5">
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3 }}
                className="w-20 h-20 rounded-3xl bg-violet-50 border border-violet-200 flex items-center justify-center text-4xl">
                ✨
              </motion.div>
              <div>
                <p className="font-display font-600 text-ink-700 text-xl mb-2">AI Resume Enhancer</p>
                <p className="text-sm text-ink-400 font-body max-w-xs">Select a resume, configure enhancement options, and let AI improve it</p>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
