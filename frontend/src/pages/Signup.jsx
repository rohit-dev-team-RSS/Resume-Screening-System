import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { role: 'candidate' } })

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      await signup(data)
      toast.success('Account created! Welcome 🎉')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Signup failed')
    } finally { setLoading(false) }
  }

  const steps = [
    { n: '01', t: 'Upload Resume', d: 'PDF or DOCX parsed by AI in seconds' },
    { n: '02', t: 'Match Jobs', d: 'Hybrid BERT + TF-IDF scoring engine' },
    { n: '03', t: 'Get Hired', d: 'Optimized resume beats ATS filters' },
  ]

  return (
    <div className="min-h-screen bg-cream-100 flex overflow-hidden">
      {/* Left Panel */}
      <motion.div
        initial={{ x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #FAF9F6 50%, #ECFDF5 100%)' }}
      >
        <div className="absolute inset-0 bg-dots opacity-30" style={{ backgroundSize: '24px 24px' }} />
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-indigo-200/40 blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-emerald-200/30 blur-3xl translate-y-1/3 -translate-x-1/4" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-14">
            <div className="w-10 h-10 rounded-xl bg-gradient-indigo flex items-center justify-center text-white font-display font-700 text-xl shadow-indigo">C</div>
            <div>
              <p className="font-display font-700 text-ink-900 text-lg">CareerAI</p>
              <p className="font-mono text-2xs text-indigo-500 tracking-widest uppercase">Smart ATS Platform</p>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <h2 className="font-display font-700 text-4xl text-ink-900 leading-tight mb-4">
              Start your AI career journey today
            </h2>
            <p className="text-ink-500 font-body text-base leading-relaxed mb-12">
              Join thousands of professionals who use CareerAI to land better jobs faster.
            </p>

            <div className="space-y-6">
              {steps.map((s, i) => (
                <motion.div key={s.n} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.12 }}
                  className="flex items-start gap-5">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-mono text-xs font-700 shrink-0 shadow-indigo">{s.n}</div>
                  <div className="pt-1">
                    <p className="font-600 text-ink-800 text-sm font-body">{s.t}</p>
                    <p className="text-ink-500 text-xs font-body mt-0.5">{s.d}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="relative p-5 rounded-2xl bg-white/80 border border-cream-300 shadow-md backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-700 shrink-0">S</div>
            <div>
              <p className="font-600 text-sm text-ink-800">"CareerAI boosted my ATS score from 42% to 87% in one session!"</p>
              <p className="text-xs text-ink-400 font-body mt-1.5">Sarah Chen · Software Engineer at Google</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <div className="mb-8">
            <h1 className="font-display font-700 text-3xl text-ink-900 leading-tight mb-2">Create your account</h1>
            <p className="text-ink-500 font-body text-sm">Free forever · No credit card required</p>
          </div>

          <div className="card p-8 shadow-xl">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="label">Full Name</label>
                <input {...register('full_name', { required: 'Full name required', minLength: { value: 4, message: 'Please enter first & last name' } })}
                  placeholder="Jane Doe" className={`input ${errors.full_name ? 'input-error' : ''}`}/>
                {errors.full_name && <p className="error-msg">⚠ {errors.full_name.message}</p>}
              </div>

              <div>
                <label className="label">Email Address</label>
                <input {...register('email', { required: 'Email required', pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' } })}
                  type="email" placeholder="you@example.com" className={`input ${errors.email ? 'input-error' : ''}`}/>
                {errors.email && <p className="error-msg">⚠ {errors.email.message}</p>}
              </div>

              <div>
                <label className="label">Password</label>
                <input {...register('password', {
                  required: 'Password required',
                  minLength: { value: 8, message: 'Min 8 characters' },
                  pattern: { value: /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/, message: 'Needs uppercase, number & symbol' }
                })}
                  type="password" placeholder="Min 8 chars · uppercase · number · symbol"
                  className={`input ${errors.password ? 'input-error' : ''}`}/>
                {errors.password && <p className="error-msg">⚠ {errors.password.message}</p>}
              </div>

              <div>
                <label className="label">I am a</label>
                <select {...register('role')} className="input">
                  <option value="candidate">Job Seeker / Candidate</option>
                  <option value="recruiter">Recruiter / Hiring Manager</option>
                </select>
              </div>

              <button type="submit" disabled={loading} className="btn-emerald w-full py-3 text-base rounded-2xl mt-2">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Creating account...
                  </span>
                ) : '🚀 Create Free Account'}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-cream-200 text-center">
              <p className="text-sm text-ink-500 font-body">
                Already have an account?{' '}
                <Link to="/login" className="text-indigo-600 font-600 hover:text-indigo-800 transition-colors">Sign in →</Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
