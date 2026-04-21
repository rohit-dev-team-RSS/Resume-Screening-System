/**
 * CheatingWarningModal — Full-screen animated warning overlay
 * Shows on HIGH/CRITICAL severity events with warning count indicator
 */
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SEVERITY_CONFIG = {
  low:      { bg:'#FFFBEB', border:'#FDE68A', text:'#92400E', accent:'#F59E0B', icon:'⚠️',  title:'Minor Alert'    },
  medium:   { bg:'#FFF7ED', border:'#FED7AA', text:'#9A3412', accent:'#F97316', icon:'⚠️',  title:'Integrity Warning' },
  high:     { bg:'#FFF1F2', border:'#FECDD3', text:'#881337', accent:'#F43F5E', icon:'🚨',  title:'Serious Violation' },
  critical: { bg:'#FFF1F2', border:'#F43F5E', text:'#7F1D1D', accent:'#DC2626', icon:'🔴',  title:'Critical Violation' },
}

const EVENT_MESSAGES = {
  face_missing:     { msg:'Please return your face to the camera frame.', sub:'Session may be paused.' },
  multiple_faces:   { msg:'Multiple people detected in frame.', sub:'Only you should be visible during the interview.' },
  looking_away:     { msg:'Please maintain eye contact with the screen.', sub:'Extended gaze deviation has been flagged.' },
  phone_detected:   { msg:'A phone or device was detected in frame.', sub:'All external resources are prohibited.' },
  tab_switch:       { msg:'You left the interview window.', sub:'All activity is monitored and recorded.' },
  window_blur:      { msg:'Interview window lost focus.', sub:'Please stay on this page.' },
  copy_paste:       { msg:'Paste attempt detected.', sub:'Answer all questions in your own words.' },
  devtools_open:    { msg:'Browser developer tools are open.', sub:'This is flagged as a critical violation.' },
  suspicious_emotion:{ msg:'Unusual behavior pattern detected.', sub:'Please focus on the interview.' },
  eyes_closed:      { msg:'Eyes not clearly visible.', sub:'Keep your eyes open and looking at the screen.' },
}

export default function CheatingWarningModal({
  event,
  warningCount,
  maxWarnings,
  onDismiss,
  autoClose = 6000,
}) {
  useEffect(() => {
    if (!event) return
    const t = setTimeout(onDismiss, autoClose)
    return () => clearTimeout(t)
  }, [event, autoClose, onDismiss])

  if (!event) return null

  const cfg = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.medium
  const em  = EVENT_MESSAGES[event.event_type] || { msg: event.details || 'Integrity event detected.', sub:'' }
  const isLast = warningCount >= maxWarnings

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        style={{
          position:'fixed', inset:0, zIndex:9999,
          background: isLast ? 'rgba(127,29,29,0.7)' : 'rgba(0,0,0,0.35)',
          backdropFilter:'blur(4px)',
          display:'flex', alignItems:'flex-start', justifyContent:'center',
          padding:'80px 24px 0',
        }}
        onClick={onDismiss}
      >
        <motion.div
          initial={{ opacity:0, y:-40, scale:0.9 }}
          animate={{ opacity:1, y:0,   scale:1   }}
          exit={{   opacity:0, y:-40, scale:0.9  }}
          transition={{ type:'spring', stiffness:400, damping:28 }}
          onClick={e => e.stopPropagation()}
          style={{
            maxWidth:460, width:'100%',
            background:cfg.bg, border:`2px solid ${cfg.border}`,
            borderRadius:20, overflow:'hidden',
            boxShadow:`0 24px 64px rgba(0,0,0,0.25), 0 0 0 4px ${cfg.accent}15`,
          }}
        >
          {/* Animated top strip */}
          <motion.div
            animate={{ backgroundPosition:['0% 50%','100% 50%','0% 50%'] }}
            transition={{ repeat:Infinity, duration:3, ease:'linear' }}
            style={{
              height:4,
              background:`linear-gradient(90deg, ${cfg.accent}, #fff, ${cfg.accent})`,
              backgroundSize:'200% 100%',
            }}
          />

          <div style={{ padding:'20px 22px 22px' }}>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:14 }}>
              <motion.span
                animate={{ scale:[1,1.15,1] }} transition={{ repeat:Infinity, duration:1.2 }}
                style={{ fontSize:28, flexShrink:0, lineHeight:1 }}>
                {cfg.icon}
              </motion.span>
              <div style={{ flex:1 }}>
                <p style={{ fontFamily:"'Sora',sans-serif", fontWeight:800, fontSize:16, color:cfg.text, marginBottom:3 }}>
                  {cfg.title}
                </p>
                <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:cfg.text, fontWeight:600, lineHeight:1.5 }}>
                  {em.msg}
                </p>
                {em.sub && (
                  <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:cfg.text, opacity:0.75, marginTop:3 }}>
                    {em.sub}
                  </p>
                )}
              </div>
              <button onClick={onDismiss}
                style={{ color:cfg.text, opacity:0.5, background:'none', border:'none', cursor:'pointer', fontSize:18, padding:2, flexShrink:0, lineHeight:1 }}>
                ✕
              </button>
            </div>

            {/* Event type badge */}
            <div style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20,
              background:`${cfg.accent}15`, border:`1px solid ${cfg.accent}40`, marginBottom:14 }}>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:700, color:cfg.accent, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                {event.event_type.replace(/_/g,' ')}
              </span>
            </div>

            {/* Warning counter */}
            <div style={{ background:`${cfg.accent}10`, borderRadius:12, padding:'10px 14px', marginBottom:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <span style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:cfg.text }}>
                  Session Warnings
                </span>
                <span style={{ fontFamily:"'Sora',sans-serif", fontSize:14, fontWeight:800, color:cfg.accent }}>
                  {warningCount} / {maxWarnings}
                </span>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                {[...Array(maxWarnings)].map((_, i) => (
                  <motion.div key={i}
                    initial={false}
                    animate={{ scale: i === warningCount - 1 ? [1,1.4,1] : 1, background: i < warningCount ? cfg.accent : '#E2E8F0' }}
                    transition={{ duration:0.5 }}
                    style={{ flex:1, height:8, borderRadius:100,
                      boxShadow: i < warningCount ? `0 0 8px ${cfg.accent}60` : 'none' }}/>
                ))}
              </div>
              {isLast && (
                <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }}
                  style={{ fontFamily:"'Sora',sans-serif", fontSize:12, fontWeight:700, color:'#7F1D1D', marginTop:8, textAlign:'center' }}>
                  ⛔ Next violation will terminate your session!
                </motion.p>
              )}
              {!isLast && (
                <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:cfg.text, opacity:0.7, marginTop:6 }}>
                  {maxWarnings - warningCount} warning{maxWarnings - warningCount !== 1 ? 's' : ''} remaining before session termination
                </p>
              )}
            </div>

            {/* Dismiss */}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={onDismiss}
                style={{
                  flex:1, padding:'10px 0', borderRadius:12, border:'none', cursor:'pointer',
                  fontFamily:"'Sora',sans-serif", fontWeight:600, fontSize:13, color:'white',
                  background:`linear-gradient(135deg,${cfg.accent},${cfg.accent}CC)`,
                  boxShadow:`0 3px 10px ${cfg.accent}40`,
                }}>
                I Understand — Continue
              </button>
            </div>

            {/* Timestamp */}
            <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:cfg.text, opacity:0.4, marginTop:8, textAlign:'right' }}>
              {new Date(event.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}