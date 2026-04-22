/**
 * LiveInterviewV2 — Production AI Mock Interview Platform
 * Features: AI avatar TTS, face detection, voice input, real-time cheating detection,
 *           per-question AI eval, reattempt, warnings system, final report
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

import { useInterviewSession, SESSION_PHASE } from '../hooks/useInterviewSession'
import { useSpeechToText, useTextToSpeech } from '../hooks/useSpeech'
import { useAdvancedDetection } from '../hooks/useAdvancedDetection'

import AIAvatar from '../components/interview/AIAvatar'
import InterviewReport from '../components/interview/InterviewReport'
import { getResumes } from '../services/api'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`

const DIFF_CONFIG = {
  easy:   { color:'#10B981', bg:'#ECFDF5', border:'#A7F3D0', label:'Easy',   time:120 },
  medium: { color:'#6366F1', bg:'#EFF6FF', border:'#BFDBFE', label:'Medium', time:180 },
  hard:   { color:'#F43F5E', bg:'#FFF1F2', border:'#FECDD3', label:'Hard',   time:240 },
}

const CHEAT_SEVERITY = {
  face_missing:    { severity:'medium', msg:'Face not detected — please stay in frame', icon:'👤' },
  multiple_faces:  { severity:'high',   msg:'Multiple faces detected — no external help allowed', icon:'👥' },
  looking_away:    { severity:'low',    msg:'Please look at your screen during the interview', icon:'👁️' },
  tab_switch:      { severity:'high',   msg:'Tab switching detected — stay on this page', icon:'🔀' },
  window_blur:     { severity:'medium', msg:'Interview window lost focus', icon:'🪟' },
  copy_paste:      { severity:'high',   msg:'Copy-paste detected — answer in your own words', icon:'📋' },
  devtools_open:   { severity:'critical',msg:'Browser DevTools detected — this is flagged', icon:'🔧' },
  phone_detected:  { severity:'high',   msg:'Possible phone usage detected', icon:'📱' },
}

// ── Warning Banner ─────────────────────────────────────────────────────────────
function WarningBanner({ event, warningCount, maxWarnings = 3, onDismiss }) {
  const cfg = CHEAT_SEVERITY[event?.event_type] || { severity:'medium', msg:event?.details || 'Integrity alert', icon:'⚠️' }
  const colors = {
    low:      { bg:'#FFFBEB', border:'#FDE68A', text:'#92400E' },
    medium:   { bg:'#FFF7ED', border:'#FED7AA', text:'#9A3412' },
    high:     { bg:'#FFF1F2', border:'#FECDD3', text:'#881337' },
    critical: { bg:'#FFF1F2', border:'#F43F5E', text:'#7F1D1D' },
  }[cfg.severity]
  return (
    <motion.div
      initial={{ opacity:0, y:-60, scale:0.95 }}
      animate={{ opacity:1, y:0,   scale:1 }}
      exit={{   opacity:0, y:-60, scale:0.95 }}
      transition={{ type:'spring', stiffness:400, damping:30 }}
      style={{
        position:'fixed', top:24, left:'50%', transform:'translateX(-50%)',
        zIndex:1000, width:'min(480px, 90vw)',
        background:colors.bg, border:`2px solid ${colors.border}`,
        borderRadius:16, padding:'16px 20px',
        boxShadow:'0 16px 48px rgba(0,0,0,0.15)',
      }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
        <span style={{ fontSize:22, flexShrink:0 }}>{cfg.icon}</span>
        <div style={{ flex:1 }}>
          <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:14, color:colors.text, marginBottom:3 }}>
            ⚠ Integrity Warning {warningCount}/{maxWarnings}
          </p>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:colors.text, lineHeight:1.5 }}>
            {cfg.msg}
          </p>
          {warningCount >= maxWarnings - 1 && (
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:'#B91C1C', fontWeight:600, marginTop:5 }}>
              ⚡ One more violation will terminate your session!
            </p>
          )}
          {/* Warning dots */}
          <div style={{ display:'flex', gap:5, marginTop:8 }}>
            {[...Array(maxWarnings)].map((_, i) => (
              <div key={i} style={{
                width:10, height:10, borderRadius:'50%',
                background: i < warningCount ? '#EF4444' : '#E5E7EB',
                transition:'background 0.3s',
              }}/>
            ))}
          </div>
        </div>
        <button onClick={onDismiss} style={{ color:colors.text, opacity:0.6, background:'none', border:'none', cursor:'pointer', fontSize:16, padding:0, flexShrink:0 }}>✕</button>
      </div>
    </motion.div>
  )
}
// ── Camera Monitor Panel (FIXED & MERGED) ───────────────────────────────────────
function CameraPanel({ 
  videoRef, canvasRef, faceStatus, gazeDir, mpReady, 
  phone, objectLabel, emotion, confidence, lookAwayMs, 
  cheatingData, warningCount, maxWarnings 
}) {
  // Status Colors Logic
  const STATUS = {
    ok:            { color:'#10B981', label:'Face OK',       dot:'#10B981' },
    missing:       { color:'#F43F5E', label:'No Face',       dot:'#F43F5E' },
    multiple:      { color:'#F59E0B', label:'Multi-Face',    dot:'#F59E0B' },
    looking_away:  { color:'#F59E0B', label:'Looking Away',  dot:'#F59E0B' },
    initializing:  { color:'#6366F1', label:'Initializing',  dot:'#6366F1' },
    error:         { color:'#F43F5E', label:'Detection Error', dot:'#F43F5E' },
  }[faceStatus] || { color:'#6366F1', label:'Monitoring', dot:'#6366F1' };

  const cheatPct = Math.round((cheatingData?.score || 0) * 100);

  // Advanced status indicators
  const phoneActive = phone ? { color: '#F43F5E', icon: '📱', label: objectLabel || 'Object' } : null;
  const emotionSuspicious = emotion && ['fearful','surprised','disgusted'].includes(emotion) ? { color: '#F59E0B', icon: '😨', label: emotion } : null;
  const longLookAway = lookAwayMs > 2000 ? { color: '#F59E0B', label: `${Math.round(lookAwayMs/1000)}s away` } : null;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {/* ── Camera + Canvas Overlay Container ── */}
      <div style={{ 
        position:'relative', borderRadius:16, overflow:'hidden', background:'#0F172A',
        border:`2px solid ${STATUS.color}30`, aspectRatio:'4/3', transition:'border-color 0.4s' 
      }}>
        
        {/* 1. Video Feed */}
        <video ref={videoRef} autoPlay playsInline muted
          style={{ width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)' }}/>
        
        {/* 2. AI Drawing Layer (Canvas) */}
        <canvas 
          ref={canvasRef} 
          style={{ 
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
            pointerEvents: 'none', transform: 'scaleX(-1)', zIndex: 10
          }} 
        />

        {/* 3. Models Loading Overlay */}
        {!mpReady && (
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:20 }}>
            <p style={{ color:'white', fontSize:11, fontWeight:600 }}>⚙️ AI MODELS INITIALIZING...</p>
          </div>
        )}

        {/* 4. REC Badge */}
        <div style={{ position:'absolute', top:8, left:8, display:'flex', alignItems:'center', gap:5,
          padding:'3px 8px', borderRadius:20, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', zIndex:30 }}>
          <motion.div animate={{ opacity:[1,0.3,1] }} transition={{ repeat:Infinity, duration:1.5 }}
            style={{ width:6, height:6, borderRadius:'50%', background:'#F43F5E' }}/>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'white', fontWeight:600 }}>REC</span>
        </div>

        {/* 5. Bottom Status Badges */}
        <div style={{ position:'absolute', bottom:8, left:8, right:8, display:'flex', alignItems:'center', justifyContent:'space-between', gap:4, flexWrap:'wrap', zIndex:30 }}>
          <div style={{ display:'flex', alignItems:'center', gap:5, padding:'3px 8px', borderRadius:20, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:STATUS.dot, boxShadow:`0 0 6px ${STATUS.dot}` }}/>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'white', fontWeight:600 }}>{STATUS.label}</span>
          </div>
          
          {phoneActive && (
            <div style={{ padding:'3px 8px', borderRadius:20, background:phoneActive.color + 'CC', backdropFilter:'blur(4px)' }}>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'white', fontWeight:600 }}>{phoneActive.icon} {phoneActive.label}</span>
            </div>
          )}
          
          {gazeDir !== 'center' && !longLookAway && (
            <div style={{ padding:'3px 8px', borderRadius:20, background:'rgba(245,158,11,0.8)', backdropFilter:'blur(4px)' }}>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'white', fontWeight:600 }}>LOOKING {gazeDir.toUpperCase()}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Integrity Score & Warnings ── */}
      <div style={{ 
        padding:'10px 14px', borderRadius:12, 
        background: cheatPct > 50 ? '#FFF1F2' : cheatPct > 20 ? '#FFFBEB' : '#ECFDF5',
        border:`1px solid ${cheatPct > 50 ? '#FECDD3' : cheatPct > 20 ? '#FDE68A' : '#A7F3D0'}` 
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <span style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:600, color:'#475569' }}>Session Integrity</span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, fontWeight:700, color: cheatPct > 50 ? '#F43F5E' : cheatPct > 20 ? '#F59E0B' : '#10B981' }}>
            {warningCount}/{maxWarnings} warnings
          </span>
        </div>
        
        <div style={{ display:'flex', gap:4, marginBottom:4 }}>
          <div style={{ flex:1, height:5, background:'#E2E8F0', borderRadius:3, overflow:'hidden' }}>
            <div style={{ 
              height:'100%', borderRadius:3, width: `${Math.max(0, confidence * 100)}%`, 
              background: confidence > 0.8 ? '#10B981' : confidence > 0.6 ? '#F59E0B' : '#F43F5E',
              transition:'width 0.6s ease' 
            }}/>
          </div>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'#94A3B8' }}>{Math.round(confidence*100)}%</span>
        </div>

        <div style={{ display:'flex', gap:5 }}>
          {[...Array(maxWarnings)].map((_, i) => (
            <div key={i} style={{ flex:1, height:4, borderRadius:100, transition:'background 0.3s', background: i < warningCount ? '#F43F5E' : '#E2E8F0' }}/>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Answer Input ───────────────────────────────────────────────────────────────
function AnswerInput({ value, onChange, onSubmit, loading, questionTimer, diffCfg, sttHook }) {
  const timeLimit = diffCfg?.time || 180
  const pct = Math.min(100, (questionTimer / timeLimit) * 100)
  const urgent = questionTimer > timeLimit * 0.8
  const timerColor = urgent ? '#F43F5E' : questionTimer > timeLimit * 0.6 ? '#F59E0B' : '#6366F1'

  return (
    <div style={{ background:'white', borderRadius:20, border:'1px solid #E2E8F0', overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
      {/* Timer bar */}
      <div style={{ height:3, background:'#F1F5F9' }}>
        <motion.div animate={{ width:`${Math.max(0, 100 - pct)}%` }} transition={{ duration:1, ease:'linear' }}
          style={{ height:'100%', background:timerColor, borderRadius:100 }}/>
      </div>

      <div style={{ padding:'14px 16px 8px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:600, color:'#64748B' }}>Your Answer</span>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:700, color:timerColor }}>
            {fmt(Math.max(0, timeLimit - questionTimer))}
          </span>
          <span style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:'#94A3B8' }}>{value.length} chars · Ctrl+Enter</span>
        </div>
      </div>

      {/* Voice transcript badge */}
      {sttHook?.listening && sttHook?.transcript && (
        <div style={{ margin:'0 16px 8px', padding:'8px 12px', borderRadius:10, background:'#EFF6FF', border:'1px solid #BFDBFE' }}>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#1D4ED8', fontStyle:'italic' }}>
            🎤 "{sttHook.transcript}"
          </p>
        </div>
      )}

      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Type your answer here... Be specific and use examples. Structure your response clearly.&#10;&#10;For behavioral questions, use the STAR method:&#10;Situation → Task → Action → Result"
        rows={9}
        style={{
          width:'100%', padding:'12px 16px', border:'none', outline:'none',
          fontFamily:"'Inter',system-ui,sans-serif", fontSize:14, color:'#1E293B',
          lineHeight:1.75, resize:'none', background:'transparent',
          boxSizing:'border-box',
        }}
      />

      {/* Controls */}
      <div style={{ padding:'10px 16px 14px', borderTop:'1px solid #F1F5F9', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
        <div style={{ display:'flex', gap:8 }}>
          {/* Voice input button */}
          {sttHook?.supported && (
            <button
              type="button"
              onClick={sttHook.toggleListening}
              style={{
                display:'flex', alignItems:'center', gap:6, padding:'7px 14px',
                borderRadius:10, border:`1.5px solid ${sttHook.listening ? '#FECDD3' : '#E2E8F0'}`,
                background: sttHook.listening ? '#FFF1F2' : 'white',
                color: sttHook.listening ? '#DC2626' : '#64748B',
                fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:600, cursor:'pointer',
                transition:'all 0.2s',
              }}>
              {sttHook.listening ? (
                <>
                  <motion.div animate={{ scale:[1,1.3,1] }} transition={{ repeat:Infinity, duration:0.8 }}
                    style={{ width:8, height:8, borderRadius:'50%', background:'#DC2626' }}/>
                  Stop Recording
                </>
              ) : (
                <><span>🎤</span> Voice Input</>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => { onChange(''); sttHook?.resetTranscript?.() }}
            style={{ padding:'7px 14px', borderRadius:10, border:'1.5px solid #E2E8F0',
              background:'white', color:'#94A3B8', fontSize:12, fontFamily:"'Inter',sans-serif", cursor:'pointer' }}>
            Clear
          </button>
        </div>

        <button
          onClick={() => onSubmit({ answerText: value, answerSource: sttHook?.listening ? 'voice' : 'text' })}
          disabled={loading || value.trim().length < 5}
          style={{
            display:'flex', alignItems:'center', gap:8, padding:'9px 22px',
            borderRadius:12, border:'none', cursor: loading || value.trim().length < 5 ? 'not-allowed' : 'pointer',
            fontFamily:"'Sora',sans-serif", fontWeight:600, fontSize:14, color:'white',
            background: loading ? '#94A3B8' : 'linear-gradient(135deg,#1565C0,#2196F3)',
            boxShadow: loading ? 'none' : '0 3px 10px rgba(21,101,192,0.35)',
            transition:'all 0.2s', opacity: value.trim().length < 5 ? 0.6 : 1,
          }}>
          {loading ? (
            <>
              <svg style={{ width:15, height:15 }} className="animate-spin" fill="none" viewBox="0 0 24 24">
                <circle style={{ opacity:0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path style={{ opacity:0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              AI Evaluating...
            </>
          ) : 'Submit Answer →'}
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════
const MAX_WARNINGS = 3

export default function LiveInterviewV2() {
  const navigate = useNavigate()

  // Session management
  const session = useInterviewSession()

  // Camera
  const videoRef     = useRef(null)
  const streamRef    = useRef(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(null)

  // Answer input
  const [answerText, setAnswerText] = useState('')

  // Warning system
  const [currentWarning, setCurrentWarning] = useState(null)
  const warningTimerRef = useRef(null)

  // STT via useSpeech hook
  const stt = useSpeechToText({
    onFinalTranscript: (text) => setAnswerText(prev => prev + (prev ? ' ' : '') + text),
  })

  // ── Advanced AI detection (4 layers) ──
  const canvasRef = useRef(null)
  const advDetection = useAdvancedDetection({
    videoRef,
    canvasRef,
    onEvent: handleCheatingEvent,
    active: session.phase === SESSION_PHASE.ACTIVE,
  })

  // Destructure everything including faceCount
  const { 
    faceStatus, 
    faceCount, 
    gazeDir, 
    mpReady, 
    phone, 
    objectLabel, 
    emotion, 
    confidence, 
    lookAwayMs 
  } = advDetection

  // ── Camera start ────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width:{ ideal:640 }, height:{ ideal:480 }, facingMode:'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => { videoRef.current.play(); setCameraReady(true) }
      }
    } catch (e) {
      setCameraError(e.message.includes('Permission') ? 'Camera permission denied' : 'Camera unavailable')
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraReady(false)
  }, [])

  useEffect(() => {
    if (session.phase !== SESSION_PHASE.SETUP) startCamera()
    return () => { if (session.phase === SESSION_PHASE.SETUP) stopCamera() }
  }, [session.phase])

// ── Sync Canvas Resolution ──
  useEffect(() => {
    const syncCanvas = () => {
      if (videoRef.current && canvasRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
      }
    };
    videoRef.current?.addEventListener('loadedmetadata', syncCanvas);
    if (videoRef.current?.readyState >= 2) syncCanvas();
    
    return () => videoRef.current?.removeEventListener('loadedmetadata', syncCanvas);
  }, [cameraReady, mpReady]); // Added mpReady as dependency

  useEffect(() => () => stopCamera(), [])

  // ── Browser event detectors ─────────────────────────────────────────────────
  useEffect(() => {
    if (session.phase !== SESSION_PHASE.ACTIVE) return

    const onHide  = () => { if (document.hidden) handleCheatingEvent({ event_type:'tab_switch', severity:'high', details:'Tab switched' }) }
    const onBlur  = () => handleCheatingEvent({ event_type:'window_blur', severity:'medium', details:'Window blurred' })
    const onPaste = e => {
      const txt = e.clipboardData?.getData('text') || ''
      if (txt.length > 15) handleCheatingEvent({ event_type:'copy_paste', severity:'high', details:`${txt.length} chars pasted` })
    }
    const checkDevTools = () => {
      if (window.outerWidth - window.innerWidth > 150 || window.outerHeight - window.innerHeight > 150) {
        handleCheatingEvent({ event_type:'devtools_open', severity:'critical', details:'DevTools detected' })
      }
    }

    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('blur', onBlur)
    document.addEventListener('paste', onPaste)
    const devInterval = setInterval(checkDevTools, 3000)

    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('paste', onPaste)
      clearInterval(devInterval)
    }
  }, [session.phase])

  // ── Cheating event handler ──────────────────────────────────────────────────
  function handleCheatingEvent(event) {
    session.recordCheatingEvent(event)
    // Show warning banner
    setCurrentWarning(event)
    clearTimeout(warningTimerRef.current)
    warningTimerRef.current = setTimeout(() => setCurrentWarning(null), 6000)
  }

  // ── Answer submit ────────────────────────────────────────────────────────────
  const handleSubmitAnswer = useCallback(async ({ answerText: text, answerSource }) => {
    await session.submitAnswer({ answerText: text, answerSource })
    setAnswerText('')
    stt.resetTranscript?.()
  }, [session, stt])

  // ── Ctrl+Enter shortcut ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && session.phase === SESSION_PHASE.ACTIVE) {
        e.preventDefault()
        handleSubmitAnswer({ answerText, answerSource: 'text' })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [answerText, session.phase, handleSubmitAnswer])

  // ── Keyboard for Briefing → Start ────────────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if (e.key === 'Enter' && session.phase === SESSION_PHASE.BRIEFING) session.startSession()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [session.phase])

  const diffCfg = DIFF_CONFIG[session.config?.difficulty] || DIFF_CONFIG.medium

  // ════════════════════════════════════════════════════════════════
  // PHASE: SETUP
  // ════════════════════════════════════════════════════════════════
  if (session.phase === SESSION_PHASE.SETUP) {
    return <SetupScreen onStart={session.createSession} loading={session.loading}/>
  }

  // ════════════════════════════════════════════════════════════════
  // PHASE: BRIEFING
  // ════════════════════════════════════════════════════════════════
  if (session.phase === SESSION_PHASE.BRIEFING) {
    return (
      <div style={{ maxWidth:680, margin:'0 auto', padding:'24px 16px' }}>
        <motion.div initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }}
          transition={{ duration:0.5, ease:[0.16,1,0.3,1] }}
          style={{ background:'white', borderRadius:24, border:'1px solid #E2E8F0', boxShadow:'0 16px 48px rgba(0,0,0,0.10)', overflow:'hidden' }}>

          {/* Header */}
          <div style={{ padding:'36px 36px 28px', textAlign:'center',
            background:'linear-gradient(135deg,#EFF6FF 0%,#F8FAFC 50%,#EFF6FF 100%)' }}>
            <motion.div animate={{ y:[0,-8,0] }} transition={{ repeat:Infinity, duration:3, ease:'easeInOut' }}
              style={{ fontSize:52, marginBottom:16 }}>🤖</motion.div>
            <h2 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:26, color:'#0F172A', marginBottom:8 }}>
              Interview Ready
            </h2>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:14, color:'#64748B' }}>
              <strong>{session.session?.total_questions}</strong> AI-crafted questions for{' '}
              <strong>{session.config?.job_title}</strong>
            </p>
          </div>

          <div style={{ padding:'28px 36px' }}>
            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
              {[
                { icon:'❓', label:'Questions', val:session.session?.total_questions },
                { icon:'⏱',  label:'Per Question', val:`${diffCfg.time}s` },
                { icon:'⚠',  label:'Max Warnings', val:MAX_WARNINGS },
              ].map(({ icon, label, val }) => (
                <div key={label} style={{ textAlign:'center', padding:'14px 8px', background:'#F8FAFC', borderRadius:14, border:'1px solid #E2E8F0' }}>
                  <div style={{ fontSize:24, marginBottom:4 }}>{icon}</div>
                  <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:20, color:'#1E293B', lineHeight:1 }}>{val}</p>
                  <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:'#94A3B8', marginTop:2 }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Camera preview */}
            <div style={{ marginBottom:20 }}>
              <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Camera Preview</p>
              <div style={{ borderRadius:14, overflow:'hidden', background:'#0F172A', aspectRatio:'16/9', maxHeight:180, position:'relative', border:'2px solid #E2E8F0' }}>
                {cameraReady ? (
                  <video ref={videoRef} autoPlay playsInline muted style={{ width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)' }}/>
                ) : (
                  <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8 }}>
                    {cameraError ? (
                      <>
                        <span style={{ fontSize:28 }}>📷</span>
                        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#94A3B8', textAlign:'center', padding:'0 16px' }}>{cameraError}</p>
                        <button onClick={startCamera} style={{ padding:'6px 16px', borderRadius:8, background:'#6366F1', color:'white', border:'none', cursor:'pointer', fontSize:12, fontFamily:"'Inter',sans-serif" }}>
                          Retry Camera
                        </button>
                      </>
                    ) : (
                      <>
                        <div style={{ width:24, height:24, borderRadius:'50%', border:'3px solid #6366F1', borderTopColor:'transparent' }} className="animate-spin"/>
                        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#94A3B8' }}>Starting camera...</p>
                      </>
                    )}
                  </div>
                )}
                {cameraReady && (
                  <div style={{ position:'absolute', bottom:8, left:8, display:'flex', alignItems:'center', gap:5, padding:'3px 8px', borderRadius:20, background:'rgba(0,0,0,0.6)' }}>
                    <motion.div animate={{ opacity:[1,0.3,1] }} transition={{ repeat:Infinity, duration:1.5 }} style={{ width:5, height:5, borderRadius:'50%', background:'#10B981' }}/>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'white' }}>CAMERA OK</span>
                  </div>
                )}
              </div>
            </div>

            {/* Rules */}
            <div style={{ padding:'14px 16px', borderRadius:14, background:'#FFFBEB', border:'1px solid #FDE68A', marginBottom:24 }}>
              <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, color:'#92400E', marginBottom:10 }}>📋 Interview Rules</p>
              {[
                `Stay in this window — tab switches are monitored`,
                `Keep your face visible in the camera at all times`,
                `${MAX_WARNINGS} warnings → automatic session termination`,
                `You can reattempt each question once`,
                `Press Ctrl+Enter to submit your answer quickly`,
              ].map((r, i) => (
                <p key={i} style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:'#92400E', display:'flex', gap:8, marginBottom:5 }}>
                  <span style={{ flexShrink:0 }}>{i+1}.</span>{r}
                </p>
              ))}
            </div>

            <button onClick={session.startSession}
              style={{
                width:'100%', padding:'15px 0', borderRadius:14, border:'none',
                fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:16, color:'white', cursor:'pointer',
                background:'linear-gradient(135deg,#1565C0 0%,#1976D2 50%,#2196F3 100%)',
                boxShadow:'0 4px 16px rgba(21,101,192,0.4)',
              }}>
              🚀 Begin Interview
            </button>
            <p style={{ textAlign:'center', fontFamily:"'Inter',sans-serif", fontSize:12, color:'#94A3B8', marginTop:8 }}>
              Press Enter to start
            </p>
          </div>
        </motion.div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // PHASE: REPORT
  // ════════════════════════════════════════════════════════════════
  if (session.phase === SESSION_PHASE.REPORT) {
    return (
      <div style={{ padding:'24px 16px' }}>
        <InterviewReport
          reportData={session.sessionReport}
          cheatingData={session.cheatingData}
          answers={session.answers}
          onRestart={session.resetSession}
        />
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // PHASE: ABORTED
  // ════════════════════════════════════════════════════════════════
  if (session.phase === SESSION_PHASE.ABORTED) {
    return (
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#FFF1F2', padding:24 }}>
        <motion.div initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }}
          style={{ maxWidth:460, width:'100%', background:'white', borderRadius:24, padding:40, textAlign:'center',
            border:'2px solid #FECDD3', boxShadow:'0 16px 48px rgba(244,63,94,0.15)' }}>
          <div style={{ fontSize:56, marginBottom:16 }}>🚨</div>
          <h2 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:24, color:'#881337', marginBottom:12 }}>
            Session Terminated
          </h2>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:14, color:'#9F1239', lineHeight:1.6, marginBottom:24 }}>
            Your interview session was terminated due to too many integrity violations. The session has been recorded and flagged for review.
          </p>
          <div style={{ padding:'12px 16px', borderRadius:12, background:'#FFF1F2', border:'1px solid #FECDD3', marginBottom:24 }}>
            <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#B91C1C' }}>
              Warnings: {session.cheatingData.warning_count} / {MAX_WARNINGS}
            </p>
          </div>
          <button onClick={session.resetSession}
            style={{ width:'100%', padding:'13px 0', borderRadius:12, border:'none',
              fontFamily:"'Sora',sans-serif", fontWeight:600, fontSize:14, color:'white', cursor:'pointer',
              background:'linear-gradient(135deg,#1565C0,#2196F3)', boxShadow:'0 4px 14px rgba(21,101,192,0.3)' }}>
            Start Fresh Interview
          </button>
        </motion.div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // PHASE: ACTIVE / EVALUATING / FEEDBACK — Main Interview UI
  // ════════════════════════════════════════════════════════════════
  const q         = session.currentQ
  const progress  = session.totalQ > 0 ? ((session.currentQIdx + (session.phase === SESSION_PHASE.FEEDBACK ? 1 : 0)) / session.totalQ) * 100 : 0

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', display:'flex', flexDirection:'column', margin:'-24px' }}>

      {/* Warning banner */}
      <AnimatePresence>
        {currentWarning && session.phase === SESSION_PHASE.ACTIVE && (
          <WarningBanner
            key={currentWarning.timestamp}
            event={currentWarning}
            warningCount={session.cheatingData.warning_count}
            maxWarnings={MAX_WARNINGS}
            onDismiss={() => setCurrentWarning(null)}
          />
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div style={{ height:56, background:'white', borderBottom:'1px solid #E2E8F0', display:'flex',
        alignItems:'center', justifyContent:'space-between', padding:'0 20px', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20,
            background:'#FFF1F2', border:'1px solid #FECDD3' }}>
            <motion.div animate={{ opacity:[1,0.3,1] }} transition={{ repeat:Infinity, duration:1.5 }}
              style={{ width:5, height:5, borderRadius:'50%', background:'#F43F5E' }}/>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, fontWeight:700, color:'#B91C1C', letterSpacing:'0.1em' }}>LIVE</span>
          </div>
          <span style={{ fontFamily:"'Inter',sans-serif", fontSize:13, fontWeight:600, color:'#1E293B' }}>
            {session.config?.job_title}
          </span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#94A3B8' }}>
            Q{session.currentQIdx + 1}/{session.totalQ}
          </span>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:700, color:'#475569' }}>
            {fmt(session.timeElapsed)}
          </span>
          <button
            onClick={() => { if (confirm('End session? Results will be saved.')) session.completeSession() }}
            style={{ padding:'5px 12px', borderRadius:8, background:'#FFF1F2', border:'1px solid #FECDD3',
              color:'#B91C1C', fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:600, cursor:'pointer' }}>
            End
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height:3, background:'#E2E8F0' }}>
        <motion.div animate={{ width:`${progress}%` }} transition={{ duration:0.6, ease:[0.16,1,0.3,1] }}
          style={{ height:'100%', background:'linear-gradient(90deg,#1565C0,#2196F3)' }}/>
      </div>

      {/* Main content */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 280px', gap:20, padding:'20px', maxWidth:1200, margin:'0 auto', width:'100%', boxSizing:'border-box' }}>

        {/* ── LEFT: Question + Answer ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:16, minWidth:0 }}>

          <AnimatePresence mode="wait">
            {session.phase === SESSION_PHASE.EVALUATING && (
              <motion.div key="evaluating"
                initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                style={{ background:'white', borderRadius:20, border:'1px solid #E2E8F0', padding:'60px 40px', textAlign:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ width:64, height:64, margin:'0 auto 20px', position:'relative' }}>
                  <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:'3px solid #EFF6FF', borderTopColor:'#6366F1' }} className="animate-spin"/>
                  <div style={{ position:'absolute', inset:8, borderRadius:'50%', border:'2px solid #ECFDF5', borderBottomColor:'#10B981' }} className="animate-spin" style2={{ animationDirection:'reverse', animationDuration:'1.4s' }}/>
                  <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>🤖</div>
                </div>
                <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:20, color:'#1E293B', marginBottom:8 }}>AI is Evaluating</p>
                <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#94A3B8' }}>
                  Analyzing relevance · Checking clarity · Computing confidence score...
                </p>
              </motion.div>
            )}

            {session.phase === SESSION_PHASE.FEEDBACK && session.currentEval && (
              <motion.div key="feedback" initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}>
                <FeedbackPanel
                  eval={session.currentEval}
                  question={q}
                  questionNum={session.currentQIdx + 1}
                  isLast={session.isLastQ}
                  onNext={session.nextQuestion}
                  onReattempt={session.reattemptQuestion}
                  loading={session.loading}
                />
              </motion.div>
            )}

            {session.phase === SESSION_PHASE.ACTIVE && q && (
              <motion.div key={`q-${session.currentQIdx}`} initial={{ opacity:0, x:24 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-24 }}
                transition={{ duration:0.35, ease:[0.16,1,0.3,1] }}
                style={{ display:'flex', flexDirection:'column', gap:16 }}>

                {/* AI Avatar + Question */}
                <div style={{ background:'white', borderRadius:20, border:'1px solid #E2E8F0', overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
                  {/* Question header */}
                  <div style={{ padding:'16px 20px', borderBottom:'1px solid #F1F5F9', display:'flex', alignItems:'center', gap:12 }}>
                    <div style={{ width:36, height:36, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:"'JetBrains Mono',monospace", fontWeight:700, fontSize:13, color:'white',
                      background:'linear-gradient(135deg,#1565C0,#2196F3)' }}>
                      {String(session.currentQIdx+1).padStart(2,'0')}
                    </div>
                    <div style={{ display:'flex', gap:8, flex:1 }}>
                      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:700,
                        padding:'2px 8px', borderRadius:20, color:diffCfg.color, background:diffCfg.bg, border:`1px solid ${diffCfg.border}` }}>
                        {q.category?.toUpperCase()}
                      </span>
                      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10,
                        padding:'2px 8px', borderRadius:20, color:diffCfg.color, background:diffCfg.bg, border:`1px solid ${diffCfg.border}` }}>
                        {session.config?.difficulty?.toUpperCase()}
                      </span>
                    </div>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#94A3B8' }}>
                      {session.currentQIdx+1}/{session.totalQ}
                    </span>
                  </div>

                  <div style={{ padding:'20px', display:'flex', gap:20, alignItems:'flex-start' }}>
                    {/* Avatar */}
                    <div style={{ flexShrink:0 }}>
                      <AIAvatar
                        question={q.text}
                        autoSpeak
                        compact={false}
                        avatarName="Alex"
                        onSpeakEnd={() => {}}
                      />
                    </div>

                    {/* Question text */}
                    <div style={{ flex:1 }}>
                      <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:600, fontSize:17, color:'#0F172A', lineHeight:1.6, marginBottom:16 }}>
                        {q.text}
                      </p>
                      {q.category === 'behavioral' && (
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                          {['Situation','Task','Action','Result'].map((s,i) => (
                            <div key={s} style={{ textAlign:'center', padding:'8px 4px', borderRadius:10, background:'#ECFDF5', border:'1px solid #A7F3D0' }}>
                              <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:14, color:'#065F46' }}>{s[0]}</p>
                              <p style={{ fontFamily:"'Inter',sans-serif", fontSize:10, color:'#059669' }}>{s}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Answer input */}
                <AnswerInput
                  value={answerText}
                  onChange={setAnswerText}
                  onSubmit={handleSubmitAnswer}
                  loading={session.phase === SESSION_PHASE.EVALUATING}
                  questionTimer={session.questionTimer}
                  diffCfg={diffCfg}
                  sttHook={stt}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── RIGHT: Camera + Status ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:14, minWidth:0 }}>
          {/* AI Avatar compact */}
          <div style={{ background:'white', borderRadius:16, border:'1px solid #E2E8F0', padding:'12px 14px' }}>
            <AIAvatar compact avatarName="Alex" speaking={session.phase === SESSION_PHASE.EVALUATING}/>
          </div>

          {/* Camera panel */}
          <div style={{ background:'white', borderRadius:16, border:'1px solid #E2E8F0', padding:12 }}>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Live Monitoring</p>
            <CameraPanel
              videoRef={videoRef}
              canvasRef={canvasRef}
              faceStatus={faceStatus}
              faceCount={faceCount}
              gazeDir={gazeDir}
              mpReady={mpReady}
              phone={phone}
              objectLabel={objectLabel}    
              emotion={emotion}
              confidence={confidence}
              lookAwayMs={lookAwayMs}
              cheatingData={session.cheatingData}
              warningCount={session.cheatingData.warning_count}
              maxWarnings={MAX_WARNINGS}
            />
          </div>

          {/* Question list */}
          <div style={{ background:'white', borderRadius:16, border:'1px solid #E2E8F0', padding:12 }}>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Progress</p>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {session.session?.questions?.slice(0,10).map((qq, i) => {
                const answered = i < session.answers.length
                const current  = i === session.currentQIdx
                const score    = answered ? session.answers[i]?.evaluation?.overall_score : null
                const c        = score >= 70 ? '#10B981' : score >= 50 ? '#6366F1' : score !== null ? '#F59E0B' : null
                return (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:8,
                    background: current ? '#EFF6FF' : answered ? '#F8FAFC' : 'transparent',
                    border: current ? '1px solid #BFDBFE' : '1px solid transparent',
                  }}>
                    <div style={{ width:20, height:20, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:"'JetBrains Mono',monospace", fontWeight:700, fontSize:10, color:'white', flexShrink:0,
                      background: current ? '#6366F1' : c || '#E2E8F0' }}>
                      {current ? '▶' : answered ? (score >= 70 ? '✓' : score >= 50 ? '~' : '✕') : i+1}
                    </div>
                    <span style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color: current ? '#1D4ED8' : '#64748B',
                      fontWeight: current ? 600 : 400, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                      {qq.category}
                    </span>
                    {answered && score !== null && (
                      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:700, color:c, flexShrink:0 }}>
                        {Math.round(score)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Feedback Panel ─────────────────────────────────────────────────────────────
function FeedbackPanel({ eval: ev, question, questionNum, isLast, onNext, onReattempt, loading }) {
  const score = ev?.overall_score || 0
  const c = score >= 80 ? '#10B981' : score >= 60 ? '#6366F1' : score >= 40 ? '#F59E0B' : '#F43F5E'
  const bg= score >= 80 ? '#ECFDF5' : score >= 60 ? '#EFF6FF' : score >= 40 ? '#FFFBEB' : '#FFF1F2'
  const border = score >= 80 ? '#A7F3D0' : score >= 60 ? '#BFDBFE' : score >= 40 ? '#FDE68A' : '#FECDD3'

  return (
    <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
      style={{ background:'white', borderRadius:20, border:`2px solid ${border}`, overflow:'hidden', boxShadow:'0 4px 20px rgba(0,0,0,0.08)' }}>

      {/* Score header */}
      <div style={{ padding:'20px 24px', background:bg, display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
        <div>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, fontWeight:700, color:c, textTransform:'uppercase', letterSpacing:'0.08em' }}>
            Q{questionNum} Feedback
          </span>
          <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:600, fontSize:15, color:'#0F172A', marginTop:4, lineHeight:1.4 }}>
            {question?.text?.slice(0,80)}{question?.text?.length > 80 ? '...' : ''}
          </p>
        </div>
        <div style={{ textAlign:'center', flexShrink:0 }}>
          <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:36, color:c, lineHeight:1 }}>{Math.round(score)}</p>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:c, fontWeight:700 }}>{ev?.grade} / 100</p>
        </div>
      </div>

      <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:14 }}>
        {/* Mini scores */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
          {[
            { label:'Relevance',  val:ev?.relevance_score  },
            { label:'Clarity',    val:ev?.clarity_score    },
            { label:'Confidence', val:ev?.confidence_score },
            { label:'Technical',  val:ev?.technical_score  },
          ].map(({ label, val }) => {
            const v = Math.round(val || 0)
            const cc = v >= 70 ? '#10B981' : v >= 50 ? '#6366F1' : '#F59E0B'
            return (
              <div key={label} style={{ textAlign:'center', padding:'10px 4px', borderRadius:10, background:'#F8FAFC', border:'1px solid #E2E8F0' }}>
                <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:20, color:cc }}>{v}</p>
                <p style={{ fontFamily:"'Inter',sans-serif", fontSize:9, color:'#94A3B8', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginTop:1 }}>{label}</p>
              </div>
            )
          })}
        </div>

        {/* AI feedback */}
        {ev?.feedback && (
          <div style={{ padding:'12px 14px', borderRadius:12, background:'#F0F9FF', border:'1px solid #BAE6FD' }}>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#0369A1', marginBottom:5 }}>🤖 AI Coach Feedback</p>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'#075985', lineHeight:1.65 }}>{ev.feedback}</p>
          </div>
        )}

        {/* Model answer */}
        {ev?.ideal_answer_summary && (
          <div style={{ padding:'12px 14px', borderRadius:12, background:'#F0FDF4', border:'1px solid #BBF7D0' }}>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#15803D', marginBottom:5 }}>💡 Model Answer</p>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:'#166534', lineHeight:1.65 }}>{ev.ideal_answer_summary}</p>
          </div>
        )}

        {/* Tips */}
        {ev?.improvement_tips?.length > 0 && (
          <div>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#64748B', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>Improvement Tips</p>
            {ev.improvement_tips.slice(0,3).map((tip, i) => (
              <div key={i} style={{ display:'flex', gap:8, marginBottom:5, fontFamily:"'Inter',sans-serif", fontSize:12, color:'#475569' }}>
                <span style={{ color:'#6366F1', flexShrink:0 }}>→</span>{tip}
              </div>
            ))}
          </div>
        )}

        {/* Filler words */}
        {(ev?.filler_word_count || 0) > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#94A3B8' }}>
              Filler words detected: <strong style={{ color:'#F59E0B' }}>{ev.filler_word_count}</strong>
            </span>
          </div>
        )}

        {/* Actions */}
        <div style={{ display:'flex', gap:10, paddingTop:4 }}>
          <button
            onClick={onReattempt}
            style={{ flex:1, padding:'11px 0', borderRadius:12, border:'1.5px solid #E2E8F0',
              background:'white', fontFamily:"'Sora',sans-serif", fontWeight:600, fontSize:13,
              color:'#64748B', cursor:'pointer', transition:'all 0.2s' }}>
            ↺ Reattempt
          </button>
          <button
            onClick={onNext}
            disabled={loading}
            style={{
              flex:2, padding:'11px 0', borderRadius:12, border:'none',
              fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:13, color:'white', cursor:'pointer',
              background: isLast ? 'linear-gradient(135deg,#10B981,#059669)' : `linear-gradient(135deg,${c},${c}CC)`,
              boxShadow:`0 4px 12px ${c}35`, transition:'all 0.2s',
            }}>
            {isLast ? '🏆 View Final Report' : 'Next Question →'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Setup Screen ───────────────────────────────────────────────────────────────
function SetupScreen({ onStart, loading }) {
  const [form, setForm] = useState({
    job_title: '', difficulty: 'medium', interview_type: 'mixed', num_questions: 8,
  })

  return (
    <div style={{ maxWidth:680, margin:'0 auto', padding:'24px 16px' }}>
      <motion.div initial={{ opacity:0, y:-16 }} animate={{ opacity:1, y:0 }}
        style={{ background:'white', borderRadius:24, border:'1px solid #E2E8F0', overflow:'hidden', boxShadow:'0 16px 48px rgba(0,0,0,0.08)' }}>

        {/* Hero */}
        <div style={{ padding:'36px', textAlign:'center',
          background:'linear-gradient(158deg,#071B38 0%,#0A2347 20%,#1246A0 65%,#1565C0 100%)',
          position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', inset:0, opacity:0.07,
            backgroundImage:'radial-gradient(circle,rgba(255,255,255,0.7) 1px,transparent 1px)',
            backgroundSize:'28px 28px' }}/>
          <motion.div animate={{ y:[0,-8,0] }} transition={{ repeat:Infinity, duration:3 }}
            style={{ fontSize:52, marginBottom:16, position:'relative' }}>🤖</motion.div>
          <h1 style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:28, color:'white', marginBottom:8, position:'relative', lineHeight:1.2 }}>
            AI Mock Interview Platform
          </h1>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:14, color:'rgba(255,255,255,0.7)', position:'relative' }}>
            Real-time face detection · Voice input · AI evaluation · Cheating detection
          </p>
        </div>

        <div style={{ padding:'32px 36px', display:'flex', flexDirection:'column', gap:18 }}>
          {/* Job Title */}
          <div>
            <label style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:7 }}>
              Target Role
            </label>
            <input
              value={form.job_title}
              onChange={e => setForm(f => ({ ...f, job_title:e.target.value }))}
              placeholder="e.g. Senior Backend Engineer"
              style={{ width:'100%', padding:'12px 16px', borderRadius:12, border:'2px solid #E2E8F0',
                fontFamily:"'Inter',sans-serif", fontSize:14, color:'#1E293B', outline:'none', boxSizing:'border-box',
                transition:'border-color 0.2s' }}
              onFocus={e => e.target.style.borderColor='#6366F1'}
              onBlur={e => e.target.style.borderColor='#E2E8F0'}
            />
          </div>

          {/* Interview Type */}
          <div>
            <label style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:7 }}>
              Interview Type
            </label>
            <select
              value={form.interview_type}
              onChange={e => setForm(f => ({ ...f, interview_type:e.target.value }))}
              style={{ width:'100%', padding:'12px 16px', borderRadius:12, border:'2px solid #E2E8F0',
                fontFamily:"'Inter',sans-serif", fontSize:14, color:'#1E293B', outline:'none', cursor:'pointer', background:'white', boxSizing:'border-box' }}>
              <option value="mixed">Mixed — Technical + Behavioral + Situational</option>
              <option value="technical">Technical — Deep skills assessment</option>
              <option value="behavioral">Behavioral — STAR method focus</option>
              <option value="situational">Situational — Problem-solving scenarios</option>
            </select>
          </div>

          {/* Difficulty */}
          <div>
            <label style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.08em', display:'block', marginBottom:7 }}>
              Difficulty
            </label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
              {['easy','medium','hard'].map(d => {
                const dc = DIFF_CONFIG[d]
                const sel = form.difficulty === d
                return (
                  <button key={d} type="button"
                    onClick={() => setForm(f => ({ ...f, difficulty:d }))}
                    style={{
                      padding:'12px 8px', borderRadius:12, border:`2px solid ${sel ? dc.color : '#E2E8F0'}`,
                      background: sel ? dc.bg : 'white', color: sel ? dc.color : '#94A3B8',
                      fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:13, textTransform:'capitalize',
                      cursor:'pointer', transition:'all 0.2s',
                      boxShadow: sel ? `0 0 0 3px ${dc.color}20` : 'none',
                    }}>
                    {d === 'easy' ? '🟢' : d === 'medium' ? '🟡' : '🔴'} {dc.label}
                    <div style={{ fontSize:10, fontWeight:400, color: sel ? dc.color : '#CBD5E1', marginTop:2 }}>
                      {dc.time}s / question
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Questions count */}
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
              <label style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                Questions
              </label>
              <span style={{ fontFamily:"'Sora',sans-serif", fontSize:14, fontWeight:700, color:'#6366F1' }}>
                {form.num_questions} (~{Math.round(form.num_questions * (DIFF_CONFIG[form.difficulty]?.time || 180) / 60)} min)
              </span>
            </div>
            <input type="range" min={3} max={15} value={form.num_questions}
              onChange={e => setForm(f => ({ ...f, num_questions:parseInt(e.target.value) }))}
              style={{ width:'100%', accentColor:'#6366F1', cursor:'pointer' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#94A3B8', marginTop:3 }}>
              <span>3 quick</span><span>8 standard</span><span>15 full</span>
            </div>
          </div>

          {/* Feature badges */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {[
              { icon:'🤖', label:'AI Avatar TTS' },
              { icon:'📷', label:'Face Detection' },
              { icon:'🎤', label:'Voice Input' },
              { icon:'⚠️', label:'Cheat Detection' },
              { icon:'📊', label:'AI Evaluation' },
              { icon:'🔄', label:'Reattempt' },
            ].map(({ icon, label }) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20,
                background:'#EFF6FF', border:'1px solid #C7D2FE', fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:600, color:'#4338CA' }}>
                <span>{icon}</span>{label}
              </div>
            ))}
          </div>

          {/* Start */}
          <motion.button
            type="button"
            onClick={() => onStart(form)}
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.01 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            style={{
              width:'100%', padding:'15px 0', borderRadius:14, border:'none',
              fontFamily:"'Sora',sans-serif", fontWeight:700, fontSize:16, color:'white',
              cursor: loading ? 'not-allowed' : 'pointer',
              background: loading ? '#94A3B8' : 'linear-gradient(135deg,#1565C0 0%,#1976D2 50%,#2196F3 100%)',
              boxShadow: loading ? 'none' : '0 6px 20px rgba(21,101,192,0.40)',
              transition:'background 0.2s,box-shadow 0.2s',
            }}>
            {loading ? (
              <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                <svg style={{ width:16, height:16 }} className="animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle style={{ opacity:0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path style={{ opacity:0.8 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Setting up your interview...
              </span>
            ) : '🚀 Start AI Interview'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}