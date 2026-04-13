import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { getResumes, matchATS } from '../services/api'
import ATSResult from '../components/ATSResult'

const SAMPLE_JD = `Senior Python Developer — Build scalable AI-powered systems.

Required Skills: Python, FastAPI, MongoDB, Docker, AWS, PostgreSQL, Redis, Kubernetes
Preferred: Terraform, React, GraphQL, CI/CD, Kafka, Spark

We are building the next generation of AI infrastructure. You'll design microservices, mentor engineers, own reliability targets, and drive technical roadmaps.

Responsibilities:
• Design and build RESTful microservices with FastAPI
• Own cloud infrastructure on AWS (EKS, S3, Lambda, RDS)
• Implement CI/CD with GitHub Actions
• Mentor junior developers through code review

Requirements:
• 5+ years Python in production
• Strong async programming and system design
• Docker and Kubernetes experience
• Bachelor's in CS or equivalent`

export default function Results() {
  const [resumes, setResumes] = useState([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [jdTitle, setJdTitle] = useState('')
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: { save_result: true, job_description: '' }
  })

  useEffect(() => {
    getResumes({ page_size: 20 })
      .then(r => setResumes((r.data.resumes || []).filter(r => r.status === 'parsed')))
      .catch(() => {})
  }, [])

  const onSubmit = async (data) => {
    if (!data.resume_id) { toast.error('Please select a parsed resume'); return }
    setLoading(true); setResult(null)
    try {
      const payload = {
        resume_id: data.resume_id,
        job_title: data.job_title || 'Target Role',
        job_description: data.job_description,
        required_skills: data.required_skills
          ? data.required_skills.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        save_result: data.save_result,
      }
      setJdTitle(payload.job_title)
      const { data: res } = await matchATS(payload)
      setResult(res)
      toast.success(`ATS Score: ${Math.round(res.scores.final_score * 100)}% — ${res.recommendation?.replace(/_/g, ' ')}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Analysis failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6 pb-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="page-title mb-1">ATS Matcher</h2>
        <p className="text-sm text-ink-400 font-body">
          Hybrid{' '}
          <span className="badge-indigo text-2xs align-middle">BERT</span>
          {' '}+{' '}
          <span className="badge-emerald text-2xs align-middle">TF-IDF</span>
          {' '}scoring — final = 0.6 × BERT + 0.4 × TF-IDF
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Config Panel */}
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          className="lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-5 sticky top-20">
            <div className="flex items-center gap-2 pb-4 border-b border-cream-200">
              <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm">⚙</div>
              <h3 className="font-display font-600 text-ink-800">Configuration</h3>
            </div>

            {/* Resume */}
            <div>
              <label className="label">Resume</label>
              {resumes.length === 0 ? (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-body text-amber-700">
                  <span>⚠</span> No parsed resumes — upload one first
                </div>
              ) : (
                <select {...register('resume_id', { required: 'Select a resume' })} className={`input ${errors.resume_id ? 'input-error' : ''}`}>
                  <option value="">— Select a resume —</option>
                  {resumes.map(r => <option key={r.id} value={r.id}>{r.original_filename}</option>)}
                </select>
              )}
              {errors.resume_id && <p className="error-msg">⚠ {errors.resume_id.message}</p>}
            </div>

            {/* Job Title */}
            <div>
              <label className="label">Job Title</label>
              <input {...register('job_title')} placeholder="e.g. Senior Python Developer" className="input"/>
            </div>

            {/* JD */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Job Description</label>
                <button type="button" onClick={() => setValue('job_description', SAMPLE_JD)}
                  className="text-2xs text-indigo-500 hover:text-indigo-700 font-600 font-mono tracking-wide transition-colors">
                  Load sample ↗
                </button>
              </div>
              <textarea
                {...register('job_description', { required: 'Required', minLength: { value: 50, message: 'Min 50 characters' } })}
                rows={9} placeholder="Paste the full job description here..."
                className={`input resize-none font-mono text-xs leading-relaxed ${errors.job_description ? 'input-error' : ''}`}
              />
              {errors.job_description && <p className="error-msg">⚠ {errors.job_description.message}</p>}
            </div>

            {/* Required Skills */}
            <div>
              <label className="label">Required Skills <span className="text-ink-300 font-body normal-case">(comma separated, optional)</span></label>
              <input {...register('required_skills')} placeholder="python, docker, aws, mongodb" className="input font-mono text-sm"/>
            </div>

            {/* Save toggle */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input type="checkbox" {...register('save_result')} defaultChecked className="sr-only peer"/>
                <div className="w-9 h-5 bg-cream-300 peer-checked:bg-indigo-500 rounded-full transition-colors duration-200"/>
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 peer-checked:translate-x-4"/>
              </div>
              <span className="text-sm font-body text-ink-600">Save result to history</span>
            </label>

            <button type="submit" disabled={loading || resumes.length === 0}
              className="btn-primary w-full py-3.5 text-base rounded-2xl">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Computing AI Score...
                </span>
              ) : '🎯 Run ATS Analysis'}
            </button>

            {/* Model info */}
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <p className="text-2xs font-mono text-indigo-400 uppercase tracking-wide">BERT</p>
                <p className="font-display font-700 text-indigo-700 mt-0.5">60%</p>
                <p className="text-2xs text-indigo-400 font-mono">Semantic</p>
              </div>
              <div className="text-center p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                <p className="text-2xs font-mono text-emerald-400 uppercase tracking-wide">TF-IDF</p>
                <p className="font-display font-700 text-emerald-700 mt-0.5">40%</p>
                <p className="text-2xs text-emerald-400 font-mono">Keywords</p>
              </div>
            </div>
          </form>
        </motion.div>

        {/* Result Panel */}
        <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
          className="lg:col-span-3">
          {loading ? (
            <div className="card p-16 flex flex-col items-center justify-center gap-8 min-h-80">
              {/* Animated loading rings */}
              <div className="relative w-28 h-28">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"/>
                <div className="absolute inset-3 rounded-full border-4 border-emerald-100 border-b-emerald-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}/>
                <div className="absolute inset-6 rounded-full border-4 border-amber-100 border-t-amber-500 animate-spin" style={{ animationDuration: '2s' }}/>
                <div className="absolute inset-0 flex items-center justify-center text-indigo-600 font-display font-700 text-lg">AI</div>
              </div>
              <div className="text-center space-y-2">
                <p className="font-display font-600 text-ink-800 text-xl">Analyzing Your Resume</p>
                <p className="text-sm font-mono text-ink-400 animate-pulse-soft">
                  Running BERT embeddings · TF-IDF vectors · Skill matching...
                </p>
              </div>
            </div>
          ) : result ? (
            <ATSResult result={result} jdTitle={jdTitle}/>
          ) : (
            <div className="card p-16 flex flex-col items-center justify-center text-center gap-6 min-h-80">
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                className="w-20 h-20 rounded-3xl bg-cream-200 flex items-center justify-center text-4xl shadow-inner">
                🎯
              </motion.div>
              <div>
                <p className="font-display font-600 text-ink-700 text-xl mb-2">Ready to Analyze</p>
                <p className="text-sm text-ink-400 font-body max-w-xs">
                  Select a parsed resume, paste a job description, and run the AI scoring engine
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {['Semantic Similarity', 'Keyword Match', 'Skill Gap Analysis', 'Explainable AI'].map(tag => (
                  <span key={tag} className="badge-indigo text-2xs">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
