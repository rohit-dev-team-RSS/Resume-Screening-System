import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'

const BASE = '/live-interview'

export const SESSION_PHASE = {
  SETUP:      'setup',
  BRIEFING:   'briefing',
  ACTIVE:     'active',
  EVALUATING: 'evaluating',
  FEEDBACK:   'feedback',
  ABORTED:    'aborted',
  REPORT:     'report',
}

export function useInterviewSession() {
  const [phase,         setPhase]       = useState(SESSION_PHASE.SETUP)
  const [session,       setSession]     = useState(null)
  const [config,        setConfig]      = useState({ job_title:'', difficulty:'medium', interview_type:'mixed', num_questions:8 })
  const [currentQIdx,   setCurrentQIdx] = useState(0)
  const [answers,       setAnswers]     = useState([])
  const [currentEval,   setCurrentEval] = useState(null)
  const [cheatingData, setCheatingData] = useState({ score:0, warning_count:0, events:[] })
  const [sessionReport, setSessionReport] = useState(null)
  const [loading,       setLoading]     = useState(false)
  const [timeElapsed,   setTimeElapsed] = useState(0)
  const [questionTimer, setQuestionTimer] = useState(0)
  const [questionStartAt, setQuestionStartAt] = useState(null)

  const timerRef     = useRef(null)
  const qTimerRef    = useRef(null)
  const cheatingQueue= useRef([])
  const flushTimer   = useRef(null)

  const questions    = session?.questions || []
  const currentQ     = questions[currentQIdx]
  const totalQ       = questions.length
  const isLastQ      = currentQIdx >= totalQ - 1

  // ── 1. FAILSAFE: 7/3 Bug Prevention ──────────────────────────────────────
  // Jaise hi state mein 3 warnings hon, turant abort phase mein bhej do
  useEffect(() => {
    if (cheatingData.warning_count >= 3 && phase !== SESSION_PHASE.ABORTED) {
      console.warn("CRITICAL: Integrity limit reached. Aborting...");
      setPhase(SESSION_PHASE.ABORTED);
    }
  }, [cheatingData.warning_count, phase]);

  // ── 2. Global session timer ───────────────────────────────────────────────
  useEffect(() => {
    if ([SESSION_PHASE.ACTIVE, SESSION_PHASE.EVALUATING, SESSION_PHASE.FEEDBACK].includes(phase)) {
      timerRef.current = setInterval(() => setTimeElapsed(t => t + 1), 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [phase])

  // ── 3. Per-question timer (Auto-Submit) ───────────────────────────────────
  useEffect(() => {
    if (phase === SESSION_PHASE.ACTIVE) {
      setQuestionTimer(0)
      setQuestionStartAt(Date.now())
      
      qTimerRef.current = setInterval(() => {
        setQuestionTimer(t => {
          const nextTime = t + 1;
          const limit = questions[currentQIdx]?.time_limit || 60; 

          if (nextTime >= limit) {
            clearInterval(qTimerRef.current);
            handleAutoSubmit(); 
            return t; 
          }
          return nextTime;
        });
      }, 1000)
    } else {
      clearInterval(qTimerRef.current)
    }
    return () => clearInterval(qTimerRef.current)
  }, [phase, currentQIdx, questions])

  const handleAutoSubmit = useCallback(() => {
    window.dispatchEvent(new CustomEvent('INTERVIEW_TIME_UP'));
  }, []);

  // ── 4. Submit answer (Updated validation) ─────────────────────────────────
  const submitAnswer = useCallback(async ({
    answerText, answerSource = 'text', voicePauses = 0,
    speechRate = 0, reattempted = false, isAuto = false // Added isAuto flag
  }) => {
    if (!currentQ || !session?.session_id) return
    
    // Agar automatic submission nahi hai toh 5 char ki validation chalao
    if (!isAuto && (!answerText?.trim() || answerText.trim().length < 5)) {
      toast.error('Please provide a more complete answer')
      return
    }

    const timeTaken = questionStartAt ? Math.round((Date.now() - questionStartAt) / 1000) : questionTimer
    setPhase(SESSION_PHASE.EVALUATING)

    try {
      const { data } = await api.post(`${BASE}/sessions/${session.session_id}/answer`, {
        question_id: currentQ.id,
        answer: answerText || "No answer provided.",
        answer_source: answerSource,
        time_taken_secs: timeTaken,
        reattempted,
        voice_pauses: voicePauses,
        speech_rate_wpm: speechRate,
      })

      setCurrentEval(data.evaluation || {})
      setAnswers(prev => [...prev, { ...data, answer: answerText }])
      setPhase(SESSION_PHASE.FEEDBACK)
    } catch (err) {
      toast.error('Evaluation failed'); setPhase(SESSION_PHASE.ACTIVE);
    }
  }, [currentQ, session, questionTimer, questionStartAt])

  // ── 5. Cheating Logic ─────────────────────────────────────────────────────
  const recordCheatingEvent = useCallback((event) => {
    setCheatingData(prev => {
      const isWarning = event.severity === 'high' || event.severity === 'medium';
      return {
        ...prev,
        warning_count: isWarning ? prev.warning_count + 1 : prev.warning_count,
        events: [...prev.events, event],
      };
    });
    cheatingQueue.current.push(event)
    if (!flushTimer.current) flushTimer.current = setTimeout(flushCheatingEvents, 2000)
  }, [])

  const flushCheatingEvents = useCallback(async () => {
    flushTimer.current = null
    const events = [...cheatingQueue.current]; cheatingQueue.current = []
    if (!session?.session_id || events.length === 0) return

    for (const ev of events) {
      try {
        const { data } = await api.post(`${BASE}/sessions/${session.session_id}/cheat`, {
          event_type: ev.event_type, severity: ev.severity || 'medium', details: ev.details || ''
        })

        setCheatingData(prev => {
          const newCount = (typeof data.warning_count === 'number') ? data.warning_count : prev.warning_count;
          return {
            ...prev,
            score: data.cheating_score !== undefined ? data.cheating_score : prev.score,
            warning_count: newCount,
          };
        });

        if (data.session_aborted) setPhase(SESSION_PHASE.ABORTED)
      } catch (err) { console.error("Cheat sync failed", err) }
    }
  }, [session])

  // ── Standard Functions (Create, Start, Next, Complete, Reset) ─────────────
  const createSession = useCallback(async (cfg) => {
    setLoading(true)
    try {
      const { data } = await api.post(`${BASE}/sessions`, {
        job_title: cfg.job_title, difficulty: cfg.difficulty,
        interview_type: cfg.interview_type, num_questions: cfg.num_questions
      })
      setSession(data); setConfig(cfg); setAnswers([]); setCurrentQIdx(0); setTimeElapsed(0);
      setCheatingData({ score:0, warning_count:0, events:[] }); setPhase(SESSION_PHASE.BRIEFING);
    } catch (err) { toast.error('Failed to create session') }
    finally { setLoading(false) }
  }, [])

  const startSession = useCallback(async () => {
    if (!session?.session_id) return
    try {
      await api.post(`${BASE}/sessions/${session.session_id}/start`)
      setPhase(SESSION_PHASE.ACTIVE)
    } catch (err) { toast.error('Failed to start session') }
  }, [session])

  const nextQuestion = useCallback(() => {
    if (isLastQ) completeSession()
    else { setCurrentQIdx(i => i + 1); setCurrentEval(null); setPhase(SESSION_PHASE.ACTIVE); }
  }, [isLastQ])

  const completeSession = useCallback(async () => {
    if (!session?.session_id) return
    setLoading(true)
    try {
      const { data } = await api.post(`${BASE}/sessions/${session.session_id}/complete`, { total_time_secs: timeElapsed })
      setSessionReport(data); setPhase(SESSION_PHASE.REPORT);
    } catch (err) { toast.error('Failed to generate report') }
    finally { setLoading(false) }
  }, [session, timeElapsed])

  const resetSession = useCallback(() => {
    setPhase(SESSION_PHASE.SETUP); setSession(null); setAnswers([]);
    setCurrentQIdx(0); setTimeElapsed(0); setCheatingData({ score:0, warning_count:0, events:[] });
  }, [])

  return {
    phase, session, currentQ, currentQIdx, totalQ, isLastQ,
    answers, currentEval, cheatingData, sessionReport,
    loading, timeElapsed, questionTimer,
    createSession, startSession, submitAnswer, nextQuestion,
    completeSession, recordCheatingEvent, resetSession,
  }
}
