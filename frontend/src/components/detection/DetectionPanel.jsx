/**
 * DetectionPanel — Real-time AI detection status HUD
 * Shows: face status, gaze direction, eye openness, object detection, emotion, confidence
 * Designed to sit in the sidebar of the live interview UI
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Gaze direction visual ─────────────────────────────────────────────────────
function GazeIndicator({ dir, offsetX, offsetY }) {
  const DOT_SIZE = 10
  const PAD      = 16
  const BOX      = 64

  // Map direction to dot position inside the box
  const dotX = BOX / 2 + offsetX * (BOX / 2 - DOT_SIZE / 2 - PAD / 2)
  const dotY = BOX / 2 + offsetY * (BOX / 2 - DOT_SIZE / 2 - PAD / 2)
  const isCenter = dir === 'center'

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
      <div style={{
        width:BOX, height:BOX, borderRadius:12, background:'#F8FAFC', border:'2px solid #E2E8F0',
        position:'relative', overflow:'hidden',
      }}>
        {/* Crosshair */}
        <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1, background:'#E2E8F0', transform:'translateX(-50%)' }}/>
        <div style={{ position:'absolute', top:'50%', left:0, right:0, height:1, background:'#E2E8F0', transform:'translateY(-50%)' }}/>
        {/* Gaze dot */}
        <motion.div
          animate={{ left: dotX - DOT_SIZE/2, top: dotY - DOT_SIZE/2 }}
          transition={{ type:'spring', stiffness:300, damping:25 }}
          style={{
            position:'absolute', width:DOT_SIZE, height:DOT_SIZE, borderRadius:'50%',
            background: isCenter ? '#10B981' : '#F59E0B',
            boxShadow: `0 0 8px ${isCenter ? 'rgba(16,185,129,0.6)' : 'rgba(245,158,11,0.6)'}`,
          }}
        />
      </div>
      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:700,
        color: isCenter ? '#10B981' : '#F59E0B', textTransform:'uppercase', letterSpacing:'0.06em' }}>
        {dir === 'center' ? 'Focused' : `Looking ${dir}`}
      </span>
    </div>
  )
}

// ── Eye openness bar ──────────────────────────────────────────────────────────
function EyeBar({ openness = 1 }) {
  const pct = Math.round(openness * 100)
  const c   = pct > 60 ? '#10B981' : pct > 30 ? '#F59E0B' : '#F43F5E'
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:'#64748B', fontWeight:600 }}>Eye Openness</span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, fontWeight:700, color:c }}>{pct}%</span>
      </div>
      <div style={{ height:6, background:'#F1F5F9', borderRadius:100, overflow:'hidden' }}>
        <motion.div animate={{ width:`${pct}%` }} transition={{ duration:0.4 }}
          style={{ height:'100%', borderRadius:100, background:c, boxShadow:`0 0 6px ${c}60` }}/>
      </div>
    </div>
  )
}

// ── Head pose compass ─────────────────────────────────────────────────────────
function HeadPoseDisplay({ yaw = 0, pitch = 0, roll = 0 }) {
  const yawClamped   = Math.max(-40, Math.min(40, yaw))
  const pitchClamped = Math.max(-40, Math.min(40, pitch))
  const isAligned    = Math.abs(yawClamped) < 12 && Math.abs(pitchClamped) < 12

  return (
    <div style={{ display:'flex', gap:10 }}>
      {[
        { label:'Yaw (L/R)',   val:yawClamped,   max:40 },
        { label:'Pitch (U/D)', val:pitchClamped, max:40 },
        { label:'Roll',        val:Math.max(-30,Math.min(30,roll)), max:30 },
      ].map(({ label, val, max }) => {
        const pct = ((val + max) / (max * 2)) * 100
        const c   = Math.abs(val) < 15 ? '#10B981' : Math.abs(val) < 25 ? '#F59E0B' : '#F43F5E'
        return (
          <div key={label} style={{ flex:1 }}>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:9, color:'#94A3B8', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600 }}>{label}</p>
            <div style={{ height:4, background:'#F1F5F9', borderRadius:100, overflow:'hidden', position:'relative' }}>
              {/* Center mark */}
              <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:2, background:'#CBD5E1', transform:'translateX(-50%)' }}/>
              <motion.div animate={{ width:`${pct}%` }} style={{ height:'100%', background:c, borderRadius:100 }} transition={{ duration:0.3 }}/>
            </div>
            <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:c, marginTop:2, fontWeight:600, textAlign:'center' }}>{val.toFixed(0)}°</p>
          </div>
        )
      })}
    </div>
  )
}

// ── Emotion badge ──────────────────────────────────────────────────────────────
function EmotionBadge({ emotion }) {
  const EMOTIONS = {
    neutral:   { icon:'😐', color:'#6366F1', bg:'#EFF6FF', label:'Neutral' },
    happy:     { icon:'😊', color:'#10B981', bg:'#ECFDF5', label:'Happy' },
    sad:       { icon:'😢', color:'#3B82F6', bg:'#EFF6FF', label:'Sad' },
    angry:     { icon:'😠', color:'#EF4444', bg:'#FFF1F2', label:'Angry' },
    fearful:   { icon:'😨', color:'#F43F5E', bg:'#FFF1F2', label:'Fearful' },
    disgusted: { icon:'🤢', color:'#F59E0B', bg:'#FFFBEB', label:'Disgusted' },
    surprised: { icon:'😲', color:'#F59E0B', bg:'#FFFBEB', label:'Surprised' },
  }
  const cfg = EMOTIONS[emotion] || { icon:'❓', color:'#94A3B8', bg:'#F8FAFC', label: emotion || 'Detecting...' }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:10,
      background:cfg.bg, border:`1px solid ${cfg.color}30` }}>
      <span style={{ fontSize:18 }}>{cfg.icon}</span>
      <div>
        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:'#64748B', fontWeight:600 }}>Emotion</p>
        <p style={{ fontFamily:"'Sora',sans-serif", fontSize:13, fontWeight:700, color:cfg.color }}>{cfg.label}</p>
      </div>
    </div>
  )
}

// ── Model status row ───────────────────────────────────────────────────────────
function ModelStatus({ mpReady, tfReady, faceApiReady }) {
  const models = [
    { label:'FaceMesh', ready:mpReady, icon:'👁️' },
    { label:'COCO-SSD', ready:tfReady, icon:'📱' },
    { label:'EmotionAI', ready:faceApiReady, icon:'😊' },
  ]
  return (
    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
      {models.map(({ label, ready, icon }) => (
        <div key={label} style={{
          display:'flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:20,
          background: ready ? '#ECFDF5' : '#F8FAFC',
          border:`1px solid ${ready ? '#A7F3D0' : '#E2E8F0'}`,
        }}>
          <div style={{ width:5, height:5, borderRadius:'50%', background: ready ? '#10B981' : '#CBD5E1',
            boxShadow: ready ? '0 0 4px rgba(16,185,129,0.5)' : 'none' }}/>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, fontWeight:600,
            color: ready ? '#065F46' : '#94A3B8', letterSpacing:'0.04em' }}>
            {icon} {label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Confidence meter ───────────────────────────────────────────────────────────
function ConfidenceMeter({ value = 1 }) {
  const pct = Math.round(value * 100)
  const c   = pct >= 70 ? '#10B981' : pct >= 40 ? '#F59E0B' : '#F43F5E'
  const label = pct >= 70 ? 'Confident' : pct >= 40 ? 'Uncertain' : 'Low Confidence'

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
        <span style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:'#64748B', fontWeight:600 }}>
          Interview Confidence
        </span>
        <span style={{ fontFamily:"'Sora',sans-serif", fontSize:12, fontWeight:700, color:c }}>{label}</span>
      </div>
      <div style={{ height:8, background:'#F1F5F9', borderRadius:100, overflow:'hidden' }}>
        <motion.div animate={{ width:`${pct}%` }} transition={{ duration:0.6, ease:[0.16,1,0.3,1] }}
          style={{ height:'100%', borderRadius:100, background:`linear-gradient(90deg,${c}88,${c})`,
            boxShadow:`0 0 8px ${c}50` }}/>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'#94A3B8' }}>0%</span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:700, color:c }}>{pct}%</span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'#94A3B8' }}>100%</span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN DetectionPanel
// ══════════════════════════════════════════════════════════════════════════════
export default function DetectionPanel({
  detectionStatus,
  videoRef,
  canvasRef,
  warningCount,
  maxWarnings,
  cheatingScore,
}) {
  const {
    faceCount, gazeDir, gazeOffX = 0, gazeOffY = 0,
    eyeOpenness, phone, objectLabel,
    emotion, confidence, headPose = { yaw:0, pitch:0, roll:0 },
    lookAwayMs, mpReady, tfReady, faceApiReady,
  } = detectionStatus || {}

  const cheatPct = Math.round((cheatingScore || 0) * 100)
  const faceOk   = faceCount === 1
  const gazeOk   = gazeDir === 'center'

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

      {/* ── Camera Feed ── */}
      <div style={{ position:'relative', borderRadius:14, overflow:'hidden', background:'#0F172A',
        border:`2px solid ${faceOk && gazeOk ? '#10B981' : faceCount === 0 ? '#F43F5E' : '#F59E0B'}30`,
        aspectRatio:'4/3', transition:'border-color 0.4s' }}>
        <video ref={videoRef} autoPlay playsInline muted
          style={{ width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)' }}/>
        {/* Canvas overlay for landmark/box drawing */}
        <canvas ref={canvasRef}
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', transform:'scaleX(-1)', pointerEvents:'none' }}/>

        {/* Corner brackets */}
        {['tl','tr','bl','br'].map(pos => (
          <div key={pos} style={{
            position:'absolute', width:16, height:16,
            top:    pos.startsWith('t') ? 7 : 'auto',
            bottom: pos.startsWith('b') ? 7 : 'auto',
            left:   pos.endsWith('l')   ? 7 : 'auto',
            right:  pos.endsWith('r')   ? 7 : 'auto',
            borderStyle:'solid', borderColor: faceOk ? '#10B981' : '#F43F5E',
            borderWidth:0,
            ...(pos==='tl' ? {borderTopWidth:2,borderLeftWidth:2} : {}),
            ...(pos==='tr' ? {borderTopWidth:2,borderRightWidth:2} : {}),
            ...(pos==='bl' ? {borderBottomWidth:2,borderLeftWidth:2} : {}),
            ...(pos==='br' ? {borderBottomWidth:2,borderRightWidth:2} : {}),
            borderRadius:3, transition:'border-color 0.4s',
          }}/>
        ))}

        {/* REC badge */}
        <div style={{ position:'absolute', top:7, left:7, display:'flex', alignItems:'center', gap:5,
          padding:'3px 8px', borderRadius:20, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)' }}>
          <motion.div animate={{ opacity:[1,0.3,1] }} transition={{ repeat:Infinity, duration:1.5 }}
            style={{ width:5, height:5, borderRadius:'50%', background:'#F43F5E' }}/>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'white', fontWeight:700, letterSpacing:'0.08em' }}>LIVE</span>
        </div>

        {/* Phone detection badge */}
        {phone && (
          <motion.div initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }}
            style={{ position:'absolute', top:7, right:7, padding:'3px 8px', borderRadius:20,
              background:'rgba(244,63,94,0.85)', backdropFilter:'blur(4px)' }}>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'white', fontWeight:700 }}>
              📱 {objectLabel}
            </span>
          </motion.div>
        )}

        {/* Face count badge */}
        <div style={{ position:'absolute', bottom:7, left:7, display:'flex', alignItems:'center', gap:5,
          padding:'3px 8px', borderRadius:20, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)' }}>
          <div style={{ width:5, height:5, borderRadius:'50%',
            background: faceCount === 0 ? '#F43F5E' : faceCount > 1 ? '#F59E0B' : '#10B981',
            boxShadow: `0 0 6px ${faceCount === 1 ? 'rgba(16,185,129,0.6)' : 'rgba(244,63,94,0.6)'}` }}/>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'white', fontWeight:600 }}>
            {faceCount === 0 ? 'No face' : faceCount === 1 ? 'Face OK' : `${faceCount} faces`}
          </span>
        </div>
      </div>

      {/* ── Model status ── */}
      <ModelStatus mpReady={mpReady} tfReady={tfReady} faceApiReady={faceApiReady}/>

      {/* ── Gaze tracker ── */}
      <div style={{ background:'white', borderRadius:14, border:'1px solid #E2E8F0', padding:'12px' }}>
        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#64748B',
          textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Eye Gaze Tracker</p>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <GazeIndicator dir={gazeDir} offsetX={gazeOffX} offsetY={gazeOffY}/>
          <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
            <EyeBar openness={eyeOpenness}/>
            {lookAwayMs > 500 && (
              <div style={{ padding:'4px 8px', borderRadius:8, background:'#FFFBEB', border:'1px solid #FDE68A' }}>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#92400E', fontWeight:600 }}>
                  Away: {(lookAwayMs/1000).toFixed(1)}s
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Head pose ── */}
      <div style={{ background:'white', borderRadius:14, border:'1px solid #E2E8F0', padding:'12px' }}>
        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#64748B',
          textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Head Pose</p>
        <HeadPoseDisplay yaw={headPose.yaw} pitch={headPose.pitch} roll={headPose.roll}/>
      </div>

      {/* ── Emotion ── */}
      <div style={{ background:'white', borderRadius:14, border:'1px solid #E2E8F0', padding:'12px' }}>
        <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#64748B',
          textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Emotion Detection</p>
        <EmotionBadge emotion={emotion}/>
      </div>

      {/* ── Confidence ── */}
      <div style={{ background:'white', borderRadius:14, border:'1px solid #E2E8F0', padding:'12px' }}>
        <ConfidenceMeter value={confidence}/>
      </div>

      {/* ── Session Integrity ── */}
      <div style={{ padding:'12px', borderRadius:14,
        background: cheatPct > 60 ? '#FFF1F2' : cheatPct > 30 ? '#FFFBEB' : '#ECFDF5',
        border:`1.5px solid ${cheatPct > 60 ? '#FECDD3' : cheatPct > 30 ? '#FDE68A' : '#A7F3D0'}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
          <span style={{ fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, color:'#475569' }}>Integrity Score</span>
          <span style={{ fontFamily:"'Sora',sans-serif", fontSize:12, fontWeight:800,
            color: cheatPct > 60 ? '#B91C1C' : cheatPct > 30 ? '#92400E' : '#065F46' }}>
            {100 - cheatPct}%
          </span>
        </div>
        <div style={{ height:6, background:'rgba(0,0,0,0.06)', borderRadius:100, overflow:'hidden', marginBottom:8 }}>
          <motion.div animate={{ width:`${100 - cheatPct}%` }} transition={{ duration:0.6 }}
            style={{ height:'100%', borderRadius:100,
              background: cheatPct > 60 ? '#F43F5E' : cheatPct > 30 ? '#F59E0B' : '#10B981' }}/>
        </div>
        {/* Warning dots */}
        <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
          {[...Array(maxWarnings)].map((_, i) => (
            <motion.div key={i}
              animate={{ scale: i < warningCount ? [1, 1.3, 1] : 1 }}
              transition={{ repeat: i < warningCount ? 2 : 0, duration: 0.4 }}
              style={{
                width:12, height:12, borderRadius:'50%', transition:'background 0.3s',
                background: i < warningCount ? '#F43F5E' : '#E2E8F0',
                boxShadow: i < warningCount ? '0 0 6px rgba(244,63,94,0.5)' : 'none',
              }}/>
          ))}
        </div>
        <p style={{ textAlign:'center', fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'#64748B', marginTop:5, fontWeight:600 }}>
          {warningCount}/{maxWarnings} warnings
        </p>
      </div>
    </div>
  )
}