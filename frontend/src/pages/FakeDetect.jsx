import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { getResumes, detectFake } from '../services/api'
import ScoreRing from '../components/ScoreRing'
import { AnimatedBar } from '../components/AnimatedNumber'

const RISK_CONFIG = {
  low: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'badge-emerald', label: 'Low Risk' },
  moderate: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'badge-amber', label: 'Moderate Risk' },
  high: { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', badge: 'badge-rose', label: 'High Risk' },
}
const VERDICT_CONFIG = {
  authentic: { color: 'text-emerald-700', icon: '✅', label: 'Authentic' },
  likely_authentic: { color: 'text-indigo-700', icon: '✓', label: 'Likely Authentic' },
  uncertain: { color: 'text-amber-700', icon: '◑', label: 'Uncertain' },
  suspicious: { color: 'text-rose-700', icon: '⚠', label: 'Suspicious' },
}

export default function FakeDetect() {
  const [resumes, setResumes] = useState([])
  const [form, setForm] = useState({ resume_id: '', github_username: '' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    getResumes({ page_size: 20 }).then(r => setResumes((r.data.resumes || []).filter(r => r.status === 'parsed'))).catch(() => {})
  }, [])

  const run = async () => {
    if (!form.resume_id) { toast.error('Select a resume'); return }
    setLoading(true); setResult(null)
    try {
      const { data } = await detectFake({ resume_id: form.resume_id, github_username: form.github_username || undefined })
      const d = data.data || data; setResult(d)
      const s = d.authenticity_score || 0
      toast[s >= 0.7 ? 'success' : 'error'](`Authenticity Score: ${Math.round(s * 100)}%`)
    } catch (err) { toast.error(err.response?.data?.detail || 'Analysis failed') }
    finally { setLoading(false) }
  }

  const risk = result?.risk_level || 'moderate'
  const verdict = result?.verdict || ''
  const riskCfg = RISK_CONFIG[risk] || RISK_CONFIG.moderate
  const verdictCfg = VERDICT_CONFIG[verdict] || { color: 'text-ink-600', icon: '○', label: verdict }
  const score = result?.authenticity_score || 0

  const FACTORS = [
    'Date Consistency', 'Skill Timeline', 'Vague Language',
    'Career Progression', 'Education Signals', 'GitHub Correlation', 'Contact Verifiability'
  ]
  const FACTOR_KEYS = [
    'date_consistency', 'skill_timeline', 'language_quality',
    'career_progression', 'education_signals', 'github_correlation', 'contact_verifiability'
  ]

  return (
    <div className="space-y-6 pb-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="page-title mb-1">Authenticity Checker</h2>
        <p className="text-sm text-ink-400 font-body">7-factor AI verification — date consistency, skill timeline, vague language, career progression</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Config */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          className="lg:col-span-2">
          <div className="card p-6 space-y-5 sticky top-20">
            <div className="flex items-center gap-2 pb-4 border-b border-cream-200">
              <div className="w-6 h-6 rounded-lg bg-rose-100 flex items-center justify-center text-sm">🔍</div>
              <h3 className="font-display font-600 text-ink-800">Verification Config</h3>
            </div>

            <div>
              <label className="label">Resume to Verify</label>
              <select className="input" value={form.resume_id} onChange={e => setForm(f => ({ ...f, resume_id: e.target.value }))}>
                <option value="">— Select —</option>
                {resumes.map(r => <option key={r.id} value={r.id}>{r.original_filename}</option>)}
              </select>
            </div>

            <div>
              <label className="label">GitHub Username <span className="text-ink-300 font-body normal-case">(boosts accuracy)</span></label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-ink-400 text-sm">@</span>
                <input className="input pl-9 font-mono" placeholder="github-username (optional)"
                  value={form.github_username} onChange={e => setForm(f => ({ ...f, github_username: e.target.value }))}/>
              </div>
              <p className="text-2xs font-mono text-ink-400 mt-1.5">Cross-validates skills with GitHub repos</p>
            </div>

            {/* Factor list */}
            <div className="p-4 bg-cream-100 border border-cream-300 rounded-xl">
              <p className="label-sm mb-3">Factors Analyzed</p>
              <div className="space-y-2">
                {FACTORS.map((f, i) => (
                  <div key={f} className="flex items-center gap-2.5 text-xs font-body text-ink-500">
                    <div className="w-5 h-5 rounded-lg bg-cream-200 border border-cream-300 flex items-center justify-center">
                      <span className="font-mono text-2xs text-ink-400">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    {f}
                  </div>
                ))}
              </div>
            </div>

            <button onClick={run} disabled={loading || resumes.length === 0}
              className="btn w-full py-3 text-base rounded-2xl text-white font-600"
              style={{ background: loading ? '#FCA5A5' : 'linear-gradient(135deg, #F43F5E 0%, #E11D48 100%)', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Verifying...
                </span>
              ) : '🔍 Verify Authenticity'}
            </button>
          </div>
        </motion.div>

        {/* Results */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
          className="lg:col-span-3 space-y-5">
          {loading ? (
            <div className="card p-16 flex flex-col items-center gap-5">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-4 border-rose-100 border-t-rose-500 animate-spin"/>
                <div className="absolute inset-3 rounded-full border-2 border-amber-100 border-b-amber-400 animate-spin" style={{ animationDirection: 'reverse' }}/>
                <div className="absolute inset-0 flex items-center justify-center text-2xl">🔍</div>
              </div>
              <div className="text-center">
                <p className="font-display font-600 text-ink-700 text-lg">Running 7-Factor Analysis</p>
                <p className="text-sm font-mono text-ink-400 mt-2 animate-pulse-soft">
                  Checking dates · Validating skills · Detecting vague language...
                </p>
              </div>
            </div>
          ) : result ? (
            <>
              {/* Score hero */}
              <div className={`card p-6 ${riskCfg.bg} ${riskCfg.border} relative overflow-hidden`}>
                <div className="absolute inset-0 bg-mesh opacity-50 pointer-events-none"/>
                <div className="relative flex flex-col md:flex-row items-center gap-6">
                  <ScoreRing score={score} size={120} label="Authenticity"/>
                  <div className="flex-1 text-center md:text-left space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`font-display font-700 text-2xl ${verdictCfg.color}`}>
                        {verdictCfg.icon} {verdictCfg.label}
                      </span>
                      <span className={`badge ${riskCfg.badge} text-xs`}>{riskCfg.label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { l: 'Experience', v: `${result.detailed_analysis?.total_experience_years || 0}y` },
                        { l: 'Roles Found', v: result.detailed_analysis?.total_roles || 0 },
                        { l: 'Has GitHub', v: result.detailed_analysis?.has_github ? 'Yes ✓' : 'No ○' },
                        { l: 'Has LinkedIn', v: result.detailed_analysis?.has_linkedin ? 'Yes ✓' : 'No ○' },
                      ].map(({ l, v }) => (
                        <div key={l} className="bg-white/70 rounded-xl p-3 border border-white shadow-xs">
                          <p className="text-2xs font-mono text-ink-400 mb-0.5">{l}</p>
                          <p className="font-600 text-sm text-ink-800 font-body">{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Factor Breakdown */}
              {result.risk_breakdown && (
                <div className="card p-5">
                  <p className="label-sm mb-4">Factor Analysis</p>
                  <div className="space-y-4">
                    {FACTOR_KEYS.map((key, i) => {
                      const val = result.risk_breakdown[key]
                      if (val === undefined) return null
                      const pct = Math.round(val * 100)
                      const color = pct >= 70 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#F43F5E'
                      return (
                        <div key={key}>
                          <div className="flex justify-between mb-1.5">
                            <span className="text-xs font-600 font-body text-ink-700">{FACTORS[i]}</span>
                            <span className="text-xs font-mono font-700" style={{ color }}>{pct}%</span>
                          </div>
                          <AnimatedBar value={pct} color={color} delay={i * 100} height={8}/>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Red Flags */}
              {result.red_flags?.length > 0 && (
                <div className="card p-5 border-rose-200">
                  <p className="label-sm mb-3 text-rose-600">⚠ Red Flags Detected ({result.red_flags.length})</p>
                  <div className="space-y-2">
                    {result.red_flags.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm font-body text-ink-700">
                        <span className="text-rose-500 shrink-0 mt-0.5">⚠</span>{f}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trust signals */}
              {result.trust_boosters?.length > 0 && (
                <div className="card p-5 border-emerald-200">
                  <p className="label-sm mb-3 text-emerald-600">✓ Trust Signals</p>
                  <div className="space-y-2">
                    {result.trust_boosters.map((b, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm font-body text-ink-700">
                        <span className="text-emerald-500 shrink-0 mt-0.5">✓</span>{b}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations?.length > 0 && (
                <div className="card p-5">
                  <p className="label-sm mb-3">Recruiter Recommendations</p>
                  <div className="space-y-2">
                    {result.recommendations.map((r, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-cream-100 border border-cream-200 rounded-xl">
                        <span className="text-indigo-500 shrink-0 mt-0.5 text-sm">→</span>
                        <p className="text-sm font-body text-ink-700 leading-relaxed">{r}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card p-16 flex flex-col items-center text-center gap-5">
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3 }}
                className="w-20 h-20 rounded-3xl bg-rose-50 border border-rose-200 flex items-center justify-center text-4xl">
                🔍
              </motion.div>
              <div>
                <p className="font-display font-600 text-ink-700 text-xl mb-2">Authenticity Detector</p>
                <p className="text-sm text-ink-400 font-body max-w-xs">7-factor AI system to verify resume authenticity and detect inflated claims</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {FACTORS.map(f => <span key={f} className="badge-rose text-2xs">{f}</span>)}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
