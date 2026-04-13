import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'

import CameraPreview from '../components/interview/CameraPreview'
import CheatingAlert from '../components/interview/CheatingAlert'
import Timer from '../components/interview/Timer'
import ScoreGauge from '../components/interview/ScoreGauge'
import FeedbackCard from '../components/interview/FeedbackCard'
import { getResumes, generateAIInterview, evaluateAnswer, completeInterviewSession, submitCheatingReport } from '../services/interviewApi'

// ── Session Phases ────────────────────────────────────────────────────────────
const PHASE = { SETUP: 'setup', BRIEFING: 'briefing', ANSWERING: 'answering', FEEDBACK: 'feedback', COMPLETE: 'complete' }

// ── Difficulty config ─────────────────────────────────────────────────────────
const DIFF_CFG = {
  easy:   { color: '#10B981', bg: '#ECFDF5', label: 'Easy', time: 90 },
  medium: { color: '#6366F1', bg: '#EEF2FF', label: 'Medium', time: 120 },
  hard:   { color: '#F43F5E', bg: '#FFF1F2', label: 'Hard', time: 180 },
}

export default function LiveInterview() {
  const navigate = useNavigate()
  const location = useLocation()

  // ── State ────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState(PHASE.SETUP)
  const [resumes, setResumes] = useState([])
  const [config, setConfig] = useState({ resume_id: '', job_title: '', difficulty: 'medium', interview_type: 'mixed', num_questions: 8 })
  const [session, setSession] = useState(null)           // { session_id, questions, session_metadata }
  const [currentQIdx, setCurrentQIdx] = useState(0)
  const [answers, setAnswers] = useState([])             // [{ question, answer, time_taken, feedback }]
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [currentFeedback, setCurrentFeedback] = useState(null)
  const [cheatingEvents, setCheatingEvents] = useState([])
  const [generating, setGenerating] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [timeUp, setTimeUp] = useState(false)
  const [timerKey, setTimerKey] = useState(0)
  const [sessionStartTime, setSessionStartTime] = useState(null)
  const [questionStartTime, setQuestionStartTime] = useState(null)
  const [totalScore, setTotalScore] = useState(0)
  const [totalPoints, setTotalPoints] = useState(0)
  const [showCamera, setShowCamera] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const textareaRef = useRef(null)

  // Load resumes
  useEffect(() => {
    getResumes({ page_size: 20 })
      .then(r => setResumes((r.data.resumes || []).filter(r => r.status === 'parsed')))
      .catch(() => {})
  }, [])

  // Pre-fill from navigation state
  useEffect(() => {
    if (location.state?.resume_id) setConfig(c => ({ ...c, resume_id: location.state.resume_id }))
    if (location.state?.job_title) setConfig(c => ({ ...c, job_title: location.state.job_title }))
  }, [location.state])

  const currentQ = session?.questions?.[currentQIdx]
  const totalQ = session?.questions?.length || 0
  const isLastQ = currentQIdx >= totalQ - 1
  const progressPct = totalQ > 0 ? Math.round(((currentQIdx + (phase === PHASE.FEEDBACK ? 1 : 0)) / totalQ) * 100) : 0
  const diffCfg = DIFF_CFG[config.difficulty] || DIFF_CFG.medium

  // ── Add cheating event ────────────────────────────────────────────────────
  const handleCheatingEvent = useCallback((event) => {
    setCheatingEvents(prev => [...prev, event])
  }, [])

  // ── Start Session ─────────────────────────────────────────────────────────
  const startGeneration = async () => {
    if (!config.resume_id) { toast.error('Select a parsed resume first'); return }
    setGenerating(true)
    try {
      const { data } = await generateAIInterview({
        resume_id: config.resume_id,
        job_title: config.job_title || 'Software Engineer',
        difficulty: config.difficulty,
        interview_type: config.interview_type,
        num_questions: parseInt(config.num_questions),
      })
      setSession(data)
      toast.success(`${data.questions?.length} questions generated!`, { icon: '🤖' })
      setPhase(PHASE.BRIEFING)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Generation failed')
    } finally { setGenerating(false) }
  }

  const beginInterview = () => {
    setPhase(PHASE.ANSWERING)
    setCurrentQIdx(0)
    setTimerKey(k => k + 1)
    setSessionStartTime(Date.now())
    setQuestionStartTime(Date.now())
    textareaRef.current?.focus()
  }

  // ── Submit Answer ─────────────────────────────────────────────────────────
  const submitAnswer = useCallback(async (auto = false) => {
    if (!currentQ) return
    if (!auto && currentAnswer.trim().length < 5) { toast.error('Please provide a more detailed answer'); return }

    const timeTaken = questionStartTime ? Math.round((Date.now() - questionStartTime) / 1000) : 0
    const answerText = auto && !currentAnswer.trim() ? '[No answer provided — time expired]' : currentAnswer

    setPhase(PHASE.FEEDBACK)
    setEvaluating(true)

    try {
      const feedbackData = await evaluateAnswer({
        question: currentQ.question,
        user_answer: answerText,
        ideal_answer: currentQ.ideal_answer || '',
        question_type: currentQ.type,
        difficulty: currentQ.difficulty || config.difficulty,
        time_taken_seconds: timeTaken,
      })

      const result = { question: currentQ.question, answer: answerText, time_taken: timeTaken, feedback: feedbackData.data || feedbackData }
      setAnswers(prev => [...prev, result])
      setCurrentFeedback(feedbackData.data || feedbackData)
      setTotalScore(prev => prev + (feedbackData.data?.score || feedbackData.score || 0))
      setTotalPoints(prev => prev + (feedbackData.data?.points_earned || feedbackData.points_earned || 0))
    } catch (err) {
      toast.error('Feedback generation failed')
      setCurrentFeedback({ score: 0, detailed_feedback: 'Evaluation unavailable', strengths: [], weaknesses: [] })
    } finally { setEvaluating(false) }
  }, [currentAnswer, currentQ, questionStartTime, config.difficulty])

  const nextQuestion = useCallback(async () => {
    if (isLastQ) {
      await endSession()
    } else {
      setCurrentQIdx(i => i + 1)
      setCurrentAnswer('')
      setCurrentFeedback(null)
      setTimeUp(false)
      setTimerKey(k => k + 1)
      setQuestionStartTime(Date.now())
      setPhase(PHASE.ANSWERING)
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [isLastQ])

  const endSession = useCallback(async () => {
    setPhase(PHASE.COMPLETE)
    const avgScore = answers.length > 0 ? totalScore / answers.length : 0

    // Submit cheating report
    if (cheatingEvents.length > 0 && session?.session_id) {
      await submitCheatingReport({ session_id: session.session_id, events: cheatingEvents }).catch(() => {})
    }

    // Award gamification points
    if (session?.session_id) {
      await completeInterviewSession({
        session_id: session.session_id,
        interview_score: avgScore / 10,
        questions_answered: answers.length,
        clean_session: cheatingEvents.length === 0,
      }).catch(() => {})
    }
  }, [answers, totalScore, cheatingEvents, session])

  const handleTimerExpire = useCallback(() => {
    setTimeUp(true)
    toast('⏰ Time\'s up! Auto-submitting...', { duration: 2000 })
    setTimeout(() => submitAnswer(true), 1500)
  }, [submitAnswer])

  // Keyboard shortcut: Ctrl+Enter to submit
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && phase === PHASE.ANSWERING) {
        e.preventDefault()
        submitAnswer()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [phase, submitAnswer])

  const avgScore = answers.length > 0 ? totalScore / answers.length : 0

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: SETUP
  // ═══════════════════════════════════════════════════════════════════════
  if (phase === PHASE.SETUP) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-8">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="relative rounded-3xl overflow-hidden p-8"
          style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4338CA 100%)' }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.3) 1px, transparent 0)', backgroundSize: '28px 28px' }}/>
          <div className="relative flex items-center justify-between flex-wrap gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
                <span className="font-mono text-indigo-300 text-xs tracking-widest uppercase">AI Interview Studio</span>
              </div>
              <h1 className="font-sora font-bold text-white text-4xl leading-tight mb-2">Live AI Interview</h1>
              <p className="text-indigo-200 text-sm font-body max-w-md">Real-time question generation · Instant AI feedback · Integrity monitoring · Gamification rewards</p>
            </div>
            <div className="hidden md:flex items-center gap-4">
              {['🤖 AI Powered', '📷 Camera Monitor', '🏆 Earn Points', '⚡ Instant Feedback'].map((tag, i) => (
                <div key={i} className="text-xs font-mono text-indigo-300 flex items-center gap-1.5">{tag}</div>
              ))}
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Config form */}
          <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
            className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm">⚙️</div>
              <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 17, color: '#0F172A' }}>Interview Setup</h2>
            </div>

            {/* Resume */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 font-mono">Resume</label>
              {resumes.length === 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 font-body">
                  ⚠ Upload and parse a resume first
                </div>
              ) : (
                <select className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-body outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  value={config.resume_id} onChange={e => setConfig(c => ({ ...c, resume_id: e.target.value }))}>
                  <option value="">— Select a parsed resume —</option>
                  {resumes.map(r => <option key={r.id} value={r.id}>{r.original_filename}</option>)}
                </select>
              )}
            </div>

            {/* Job Title */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 font-mono">Target Role</label>
              <input className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-body outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                placeholder="e.g. Senior Backend Engineer" value={config.job_title}
                onChange={e => setConfig(c => ({ ...c, job_title: e.target.value }))}/>
            </div>

            {/* Interview Type */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 font-mono">Interview Type</label>
              <select className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-body outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                value={config.interview_type} onChange={e => setConfig(c => ({ ...c, interview_type: e.target.value }))}>
                <option value="mixed">Mixed — Technical + Behavioral + Situational</option>
                <option value="technical">Technical Only — Deep skills assessment</option>
                <option value="behavioral">Behavioral — STAR method focus</option>
                <option value="situational">Situational — Problem-solving scenarios</option>
              </select>
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 font-mono">Difficulty</label>
              <div className="grid grid-cols-3 gap-3">
                {['easy', 'medium', 'hard'].map(d => {
                  const dc = DIFF_CFG[d]
                  return (
                    <button key={d} type="button"
                      onClick={() => setConfig(c => ({ ...c, difficulty: d }))}
                      className="py-3 rounded-xl border-2 text-sm font-bold capitalize transition-all"
                      style={{
                        borderColor: config.difficulty === d ? dc.color : '#E2E8F0',
                        background: config.difficulty === d ? dc.bg : 'white',
                        color: config.difficulty === d ? dc.color : '#94A3B8',
                        boxShadow: config.difficulty === d ? `0 0 0 3px ${dc.color}15` : 'none',
                      }}>
                      {d === 'easy' ? '🟢' : d === 'medium' ? '🟡' : '🔴'} {dc.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Questions count */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 font-mono">Questions: {config.num_questions}</label>
              <input type="range" min="5" max="20" step="1" value={config.num_questions}
                onChange={e => setConfig(c => ({ ...c, num_questions: parseInt(e.target.value) }))}
                className="w-full accent-indigo-500 cursor-pointer"/>
              <div className="flex justify-between text-2xs font-mono text-slate-400 mt-1">
                <span>5 (~25min)</span><span>10 (~50min)</span><span>15 (~75min)</span><span>20 (~100min)</span>
              </div>
            </div>

            {/* Camera toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <p className="text-sm font-semibold text-slate-700 font-body">Camera Monitoring</p>
                <p className="text-xs text-slate-400 font-body mt-0.5">Enable for integrity tracking and anti-cheating</p>
              </div>
              <label className="relative cursor-pointer">
                <input type="checkbox" checked={showCamera} onChange={e => setShowCamera(e.target.checked)} className="sr-only peer"/>
                <div className="w-11 h-6 bg-slate-300 peer-checked:bg-indigo-500 rounded-full transition-colors"/>
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5"/>
              </label>
            </div>

            <button onClick={startGeneration} disabled={generating || resumes.length === 0}
              className="w-full py-3.5 rounded-2xl text-white font-bold text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: generating ? '#94A3B8' : 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: generating ? 'none' : '0 4px 16px rgba(79,70,229,0.35)' }}>
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  AI is crafting your interview...
                </span>
              ) : '🤖 Generate AI Interview →'}
            </button>
          </motion.div>

          {/* Info panel */}
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
            className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h3 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 15, color: '#1E293B', marginBottom: 12 }}>What to Expect</h3>
              {[
                { icon: '🤖', title: 'AI-Powered Questions', desc: 'Generated by LLM based on your resume and target role' },
                { icon: '📷', title: 'Camera Monitoring', desc: 'Face detection and presence tracking throughout' },
                { icon: '⚡', title: 'Instant Feedback', desc: 'AI evaluates each answer in real-time with score' },
                { icon: '🏆', title: 'Earn Rewards', desc: 'Points, badges, and leaderboard rankings' },
                { icon: '⏱', title: 'Timed Questions', desc: `${DIFF_CFG[config.difficulty].time}s per question at ${config.difficulty} difficulty` },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3 mb-3 last:mb-0">
                  <span className="text-lg shrink-0">{icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-slate-700 font-body">{title}</p>
                    <p className="text-xs text-slate-400 font-body mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-4">
              <p className="text-xs font-bold text-indigo-700 font-mono uppercase tracking-wide mb-2">💡 Pro Tips</p>
              {['Speak clearly and structure your answers', 'Use STAR method for behavioral questions', 'Think out loud during technical problems', 'Keep camera centered and well-lit'].map((tip, i) => (
                <p key={i} className="text-xs text-indigo-600 font-body flex items-start gap-1.5 mb-1.5 last:mb-0">
                  <span className="text-indigo-400 shrink-0 mt-0.5">→</span>{tip}
                </p>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: BRIEFING
  // ═══════════════════════════════════════════════════════════════════════
  if (phase === PHASE.BRIEFING) {
    const meta = session?.session_metadata || {}
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-8">
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="p-8 text-center" style={{ background: 'linear-gradient(135deg, #EEF2FF, #F8F9FC)' }}>
            <div className="w-16 h-16 rounded-3xl bg-indigo-600 flex items-center justify-center text-3xl mx-auto mb-5 shadow-lg"
              style={{ boxShadow: '0 8px 24px rgba(79,70,229,0.35)' }}>🤖</div>
            <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 28, color: '#1E293B', marginBottom: 8 }}>
              Your Interview is Ready
            </h2>
            <p className="text-slate-500 font-body text-sm max-w-sm mx-auto">
              {meta.total_questions} AI-crafted questions for {meta.job_title}. Take a moment to compose yourself before we begin.
            </p>
          </div>

          <div className="p-8 space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: '❓', label: 'Questions', value: meta.total_questions || session?.questions?.length || 0 },
                { icon: '⏱', label: 'Per Question', value: `${diffCfg.time}s` },
                { icon: '🏆', label: 'Max Points', value: `~${(meta.total_questions || 10) * 20}` },
              ].map(({ icon, label, value }) => (
                <div key={label} className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-2xl mb-1">{icon}</div>
                  <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 22, color: '#1E293B' }}>{value}</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Rules */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
              <p className="text-xs font-bold text-amber-700 font-mono uppercase tracking-wide mb-2">📋 Interview Rules</p>
              {[
                'Stay in this window — tab switches are monitored',
                'Keep your face visible in the camera at all times',
                'No copy-pasting from external sources',
                'Press Ctrl+Enter to submit your answer',
                'You can pass any question if you\'re stuck',
              ].map((rule, i) => (
                <p key={i} className="text-xs text-amber-700 font-body flex items-start gap-2 mb-1 last:mb-0">
                  <span className="shrink-0">{i + 1}.</span>{rule}
                </p>
              ))}
            </div>

            {/* Question preview */}
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
              <p className="text-xs font-bold text-indigo-600 font-mono uppercase tracking-wide mb-2">📝 First Question Preview</p>
              <p className="text-sm text-indigo-800 font-body leading-relaxed">
                {session?.questions?.[0]?.question || 'Question will appear when you begin...'}
              </p>
            </div>

            <button onClick={beginInterview}
              className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: '0 4px 20px rgba(79,70,229,0.4)' }}>
              🚀 Start Interview Now
            </button>
            <button onClick={() => setPhase(PHASE.SETUP)} className="w-full py-2.5 rounded-xl text-slate-500 text-sm hover:text-slate-700 hover:bg-slate-50 transition-all font-body">
              ← Back to Setup
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: ANSWERING / FEEDBACK
  // ═══════════════════════════════════════════════════════════════════════
  if (phase === PHASE.ANSWERING || phase === PHASE.FEEDBACK) {
    return (
      <div className="h-screen flex overflow-hidden bg-slate-50" style={{ paddingTop: 0, margin: -24 }}>
        {/* ── Sidebar ── */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden"
            >
              {/* Session info */}
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"/>
                  <span className="text-xs font-mono font-bold text-slate-600 uppercase tracking-wider">Live Session</span>
                </div>
                <p className="font-sora font-bold text-slate-800 text-sm leading-tight">
                  {session?.session_metadata?.job_title || 'Interview'}
                </p>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  Q{currentQIdx + 1} of {totalQ} · {config.difficulty}
                </p>
                {/* Progress bar */}
                <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full rounded-full bg-indigo-500"
                  />
                </div>
                <p className="text-xs font-mono text-slate-400 mt-1">{progressPct}% complete</p>
              </div>

              {/* Timer */}
              {phase === PHASE.ANSWERING && (
                <div className="p-4 border-b border-slate-100 flex justify-center">
                  <Timer
                    key={timerKey}
                    seconds={diffCfg.time}
                    autoStart
                    onExpire={handleTimerExpire}
                    size="md"
                  />
                </div>
              )}

              {/* Camera */}
              {showCamera && (
                <div className="p-3 border-b border-slate-100">
                  <CameraPreview onEvent={handleCheatingEvent} compact/>
                </div>
              )}

              {/* Integrity / Cheating monitor */}
              <div className="p-3 border-b border-slate-100">
                <CheatingAlert onEvent={handleCheatingEvent} active={phase === PHASE.ANSWERING}/>
              </div>

              {/* Question list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                <p className="text-2xs font-mono text-slate-400 uppercase tracking-widest px-1 mb-2">Questions</p>
                {(session?.questions || []).map((q, i) => {
                  const answered = i < answers.length
                  const current = i === currentQIdx
                  const score = answered ? answers[i]?.feedback?.score : null
                  const scoreColor = score >= 8 ? '#10B981' : score >= 5 ? '#6366F1' : '#F43F5E'
                  return (
                    <div key={i} className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition-all ${current ? 'bg-indigo-50 border border-indigo-200' : answered ? 'bg-slate-50' : 'text-slate-400'}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-2xs font-bold ${current ? 'bg-indigo-600 text-white' : answered ? 'text-white' : 'bg-slate-100 text-slate-400'}`}
                        style={{ background: answered && !current ? scoreColor : current ? '#4F46E5' : undefined }}>
                        {answered ? (score >= 7 ? '✓' : score >= 4 ? '~' : '✕') : i + 1}
                      </div>
                      <span className={`truncate font-body ${current ? 'text-indigo-700 font-semibold' : answered ? 'text-slate-600' : 'text-slate-400'}`}>
                        {q.category}
                      </span>
                    </div>
                  )
                })}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* ── Main Area ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
            <button onClick={() => setSidebarOpen(o => !o)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"/>
                RECORDING
              </div>
              <span className="text-xs font-mono text-indigo-600 font-bold">Q{currentQIdx + 1}/{totalQ}</span>
              <span className="text-xs font-mono text-amber-600">+{totalPoints} pts</span>
            </div>
            <button onClick={() => { if (confirm('End interview session?')) endSession() }}
              className="text-xs text-slate-400 hover:text-rose-500 px-2 py-1 rounded-lg hover:bg-rose-50 transition-all font-mono">
              End Session
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <AnimatePresence mode="wait">
              {phase === PHASE.ANSWERING && currentQ && (
                <motion.div key={`q-${currentQIdx}`}
                  initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-4 max-w-3xl mx-auto">

                  {/* Question card */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center font-mono text-indigo-700 font-bold text-sm">
                          {String(currentQIdx + 1).padStart(2, '0')}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2.5 py-1 rounded-full font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-200">
                            {currentQ.type}
                          </span>
                          <span className="text-xs px-2.5 py-1 rounded-full font-mono text-slate-500 bg-slate-50 border border-slate-200">
                            {currentQ.category}
                          </span>
                          <span className="text-xs font-mono font-bold" style={{ color: diffCfg.color }}>
                            ● {currentQ.difficulty || config.difficulty}
                          </span>
                        </div>
                      </div>
                      {currentQ.time_limit_seconds && (
                        <span className="text-xs font-mono text-slate-400">{currentQ.time_limit_seconds}s limit</span>
                      )}
                    </div>

                    <div className="p-6">
                      <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 18, color: '#0F172A', lineHeight: 1.5 }}>
                        {currentQ.question}
                      </p>

                      {currentQ.type === 'behavioral' && (
                        <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                          <span className="text-emerald-500 text-sm">💡</span>
                          <p className="text-xs text-emerald-700 font-body">Use the <span className="font-bold">STAR method</span>: Situation → Task → Action → Result</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Answer input */}
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-mono text-slate-400 uppercase tracking-wide">Your Answer</span>
                      <span className="text-xs font-mono text-slate-400">{currentAnswer.length} chars · Ctrl+Enter to submit</span>
                    </div>
                    <textarea
                      ref={textareaRef}
                      value={currentAnswer}
                      onChange={e => setCurrentAnswer(e.target.value)}
                      placeholder="Type your answer here... Be detailed and specific. Structure your response clearly."
                      rows={10}
                      className="w-full px-5 py-4 text-sm font-body text-slate-800 placeholder-slate-300 resize-none outline-none"
                      style={{ fontFamily: "'Inter', sans-serif", lineHeight: 1.7 }}
                    />
                    <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                      <button onClick={() => { setCurrentAnswer(''); toast('Answer cleared', { duration: 1500 }) }}
                        className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition-all font-mono">
                        Clear
                      </button>
                      <div className="flex items-center gap-2">
                        <button onClick={() => nextQuestion()}
                          className="text-xs text-slate-400 hover:text-amber-500 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-all font-mono border border-slate-200">
                          Skip →
                        </button>
                        <button onClick={() => submitAnswer()}
                          disabled={evaluating}
                          className="px-5 py-2 rounded-xl text-white text-sm font-bold transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: '0 2px 8px rgba(79,70,229,0.3)' }}>
                          {evaluating ? 'Evaluating...' : 'Submit Answer →'}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {phase === PHASE.FEEDBACK && (
                <motion.div key={`fb-${currentQIdx}`}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="max-w-3xl mx-auto">
                  {evaluating ? (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 flex flex-col items-center gap-6">
                      <div className="relative w-20 h-20">
                        <div className="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"/>
                        <div className="absolute inset-4 rounded-full border-2 border-emerald-100 border-b-emerald-500 animate-spin" style={{ animationDirection: 'reverse' }}/>
                        <div className="absolute inset-0 flex items-center justify-center text-2xl">🤖</div>
                      </div>
                      <div className="text-center">
                        <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 20, color: '#1E293B' }}>AI is evaluating your answer</p>
                        <p className="text-sm text-slate-400 font-mono mt-2 animate-pulse">Analyzing depth · Checking accuracy · Generating feedback...</p>
                      </div>
                    </div>
                  ) : (
                    <FeedbackCard
                      feedback={currentFeedback}
                      question={currentQ?.question}
                      questionNumber={currentQIdx + 1}
                      onNext={nextQuestion}
                      isLast={isLastQ}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: COMPLETE
  // ═══════════════════════════════════════════════════════════════════════
  if (phase === PHASE.COMPLETE) {
    const sessionDuration = sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 60000) : 0
    const avgPct = Math.round(avgScore * 10)
    const grade = avgScore >= 9 ? 'A+' : avgScore >= 8 ? 'A' : avgScore >= 7 ? 'B+' : avgScore >= 6 ? 'B' : avgScore >= 5 ? 'C' : 'D'

    return (
      <div className="max-w-3xl mx-auto space-y-6 pb-8">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>

          {/* Hero result */}
          <div className="rounded-3xl overflow-hidden shadow-2xl" style={{ background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)' }}>
            <div className="p-10 text-center">
              <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.6, delay: 0.3 }} className="text-6xl mb-4">
                {avgScore >= 8 ? '🏆' : avgScore >= 6 ? '🎯' : avgScore >= 4 ? '📈' : '💪'}
              </motion.div>
              <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 36, color: 'white', marginBottom: 8 }}>
                Interview Complete!
              </h2>
              <p className="text-indigo-300 font-body mb-8">Here's your performance summary</p>
              <div className="flex justify-center mb-8">
                <ScoreGauge score={avgScore} maxScore={10} size={160} label="Overall Score"/>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { val: answers.length, label: 'Answered' },
                  { val: grade, label: 'Grade' },
                  { val: `${totalPoints}`, label: 'Points Earned' },
                  { val: `${sessionDuration}m`, label: 'Duration' },
                ].map(({ val, label }) => (
                  <div key={label} className="bg-white/10 rounded-2xl p-4 text-center backdrop-blur-sm">
                    <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 24, color: 'white' }}>{val}</div>
                    <div className="text-xs text-indigo-300 font-mono mt-1">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cheating summary */}
            {cheatingEvents.length > 0 && (
              <div className="px-10 pb-6">
                <div className="p-4 rounded-2xl bg-amber-500/20 border border-amber-400/40">
                  <p className="text-sm text-amber-200 font-mono font-bold">⚠ {cheatingEvents.length} integrity event{cheatingEvents.length > 1 ? 's' : ''} were recorded during this session.</p>
                </div>
              </div>
            )}
          </div>

          {/* Per-question breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 18, color: '#1E293B', marginBottom: 16 }}>Question Breakdown</h3>
            <div className="space-y-3">
              {answers.map((ans, i) => {
                const sc = ans.feedback?.score || 0
                const color = sc >= 8 ? '#10B981' : sc >= 5 ? '#6366F1' : '#F43F5E'
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0"
                      style={{ background: color }}>
                      {sc.toFixed(1)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 font-body truncate">
                        Q{i + 1}: {(session?.questions?.[i]?.category) || 'Question'}
                      </p>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{ans.feedback?.grade} · {ans.time_taken}s</p>
                    </div>
                    <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden shrink-0">
                      <div className="h-full rounded-full" style={{ width: `${sc * 10}%`, background: color }}/>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => { setPhase(PHASE.SETUP); setAnswers([]); setSession(null); setTotalScore(0); setTotalPoints(0); setCheatingEvents([]) }}
              className="py-3.5 rounded-2xl font-bold text-sm border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-all font-body">
              🔄 Start New Interview
            </button>
            <button onClick={() => navigate('/gamification')}
              className="py-3.5 rounded-2xl text-white font-bold text-sm transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}>
              🏆 View Rewards →
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  return null
}
