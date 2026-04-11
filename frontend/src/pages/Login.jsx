import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

const features = [
  { icon: '🎯', title: 'Hybrid ATS Scoring', desc: 'BERT + TF-IDF dual engine with 95% accuracy' },
  { icon: '🧠', title: 'Explainable AI', desc: 'Transparent scoring with actionable insights' },
  { icon: '📊', title: 'Career Analytics', desc: 'Track progress and market demand trends' },
  { icon: '✨', title: 'AI Resume Enhancer', desc: 'LLM-powered improvements and keyword injection' },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm()

  const onSubmit = async ({ email, password }) => {
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid credentials')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-cream-100 flex overflow-hidden">
      {/* Left — Hero Panel */}
      <motion.div
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="hidden lg:flex flex-col justify-between w-[520px] shrink-0 bg-ink-900 p-12 relative overflow-hidden"
      >
        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl" />
          <div className="absolute -bottom-32 -right-20 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px]"
            style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)' }} />
          {/* Dot grid */}
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        </div>

        {/* Logo */}
        <div className="relative">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-gradient-indigo flex items-center justify-center text-white font-display font-700 text-xl shadow-indigo">
              C
            </div>
            <div>
              <p className="font-display font-700 text-white text-lg leading-tight">CareerAI</p>
              <p className="font-mono text-2xs text-indigo-400 tracking-widest uppercase">Smart ATS Platform</p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <h2 className="font-display font-700 text-4xl text-white leading-tight mb-4">
              Land your dream job with{' '}
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #818CF8, #C4B5FD)' }}>
                AI precision
              </span>
            </h2>
            <p className="text-ink-400 font-body text-base leading-relaxed mb-10">
              The most advanced resume intelligence platform. Get ATS scores, skill gap analysis, and AI-powered improvements in seconds.
            </p>

            <div className="space-y-4">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/8 backdrop-blur-sm"
                >
                  <span className="text-xl shrink-0 mt-0.5">{f.icon}</span>
                  <div>
                    <p className="font-600 text-white text-sm font-body">{f.title}</p>
                    <p className="text-ink-400 text-xs font-body mt-0.5">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Stats */}
        <div className="relative grid grid-cols-3 gap-6 pt-10 border-t border-white/10">
          {[{ n: '50K+', l: 'Resumes Analyzed' }, { n: '92%', l: 'Match Accuracy' }, { n: '3x', l: 'Interview Rate' }].map(s => (
            <div key={s.l}>
              <p className="font-display font-700 text-2xl text-white">{s.n}</p>
              <p className="text-xs text-ink-400 font-body mt-1">{s.l}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-indigo flex items-center justify-center text-white font-display font-700 text-lg shadow-indigo">C</div>
            <p className="font-display font-700 text-ink-900 text-xl">CareerAI</p>
          </div>

          <div className="mb-8">
            <h1 className="font-display font-700 text-3xl text-ink-900 leading-tight mb-2">Sign in to your account</h1>
            <p className="text-ink-500 font-body text-sm">Access your career intelligence dashboard</p>
          </div>

          <div className="card p-8 shadow-xl">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="label">Email address</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                  </div>
                  <input
                    {...register('email', { required: 'Email required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })}
                    type="email" placeholder="you@example.com"
                    className={`input pl-10 ${errors.email ? 'input-error' : ''}`}
                  />
                </div>
                {errors.email && <p className="error-msg">⚠ {errors.email.message}</p>}
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-300">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                  </div>
                  <input
                    {...register('password', { required: 'Password required' })}
                    type="password" placeholder="••••••••"
                    className={`input pl-10 ${errors.password ? 'input-error' : ''}`}
                  />
                </div>
                {errors.password && <p className="error-msg">⚠ {errors.password.message}</p>}
              </div>

              <button type="submit" disabled={loading}
                className="btn-primary w-full py-3 text-base rounded-2xl mt-2 relative overflow-hidden"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">Sign In <span>→</span></span>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-cream-200 text-center">
              <p className="text-sm text-ink-500 font-body">
                Don't have an account?{' '}
                <Link to="/signup" className="text-indigo-600 font-600 hover:text-indigo-800 transition-colors">Create one free →</Link>
              </p>
            </div>
          </div>

          {/* Demo hint */}
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5">
            <span className="text-amber-500 shrink-0">💡</span>
            <p className="text-xs font-mono text-amber-700">Demo: admin@example.com / AdminPass123!</p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
