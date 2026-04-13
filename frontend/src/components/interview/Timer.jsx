import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Timer({
  seconds = 120,
  onExpire,
  onTick,
  autoStart = false,
  size = 'md',
  showProgress = true,
}) {
  const [remaining, setRemaining] = useState(seconds)
  const [running, setRunning] = useState(autoStart)
  const [expired, setExpired] = useState(false)
  const intervalRef = useRef(null)

  const start = useCallback(() => setRunning(true), [])
  const pause = useCallback(() => setRunning(false), [])
  const reset = useCallback(() => {
    setRunning(false)
    setRemaining(seconds)
    setExpired(false)
  }, [seconds])

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining(prev => {
          const next = prev - 1
          onTick?.(next)
          if (next <= 0) {
            setRunning(false)
            setExpired(true)
            onExpire?.()
            return 0
          }
          return next
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running, remaining, onTick, onExpire])

  useEffect(() => {
    setRemaining(seconds)
    setExpired(false)
    if (autoStart) setRunning(true)
  }, [seconds, autoStart])

  const pct = (remaining / seconds) * 100
  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

  const urgentThreshold = seconds * 0.2
  const warnThreshold = seconds * 0.4
  const isUrgent = remaining <= urgentThreshold
  const isWarning = remaining <= warnThreshold && !isUrgent

  const COLOR = isUrgent ? '#F43F5E' : isWarning ? '#F59E0B' : '#6366F1'
  const TRACK = isUrgent ? '#FFE4E6' : isWarning ? '#FEF3C7' : '#EEF2FF'
  const BG = isUrgent ? 'bg-rose-50 border-rose-200' : isWarning ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50 border-indigo-200'

  const SIZES = {
    sm: { outer: 72, stroke: 5, font: 14 },
    md: { outer: 96, stroke: 6, font: 18 },
    lg: { outer: 128, stroke: 8, font: 24 },
  }
  const sz = SIZES[size] || SIZES.md
  const r = (sz.outer / 2) - sz.stroke - 2
  const circ = 2 * Math.PI * r
  const dashOffset = circ - (pct / 100) * circ

  return (
    <div className="flex flex-col items-center gap-3">
      <div style={{ position: 'relative', width: sz.outer, height: sz.outer }}>
        {/* Pulse ring when urgent */}
        {isUrgent && (
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ repeat: Infinity, duration: 1 }}
            style={{
              position: 'absolute', inset: -4, borderRadius: '50%',
              border: `2px solid ${COLOR}`,
            }}
          />
        )}
        <svg width={sz.outer} height={sz.outer} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={sz.outer/2} cy={sz.outer/2} r={r} fill="none" stroke={TRACK} strokeWidth={sz.stroke}/>
          <circle cx={sz.outer/2} cy={sz.outer/2} r={r} fill="none" stroke={COLOR} strokeWidth={sz.stroke}
            strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease', filter: `drop-shadow(0 0 4px ${COLOR}60)` }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <AnimatePresence mode="wait">
            <motion.span
              key={Math.floor(remaining / 10)}
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              style={{
                fontFamily: "'JetBrains Mono', monospace", fontWeight: 600,
                fontSize: sz.font, color: COLOR, lineHeight: 1,
              }}
            >
              {timeStr}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {!expired ? (
          running ? (
            <button onClick={pause}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all bg-white border-slate-200 text-slate-600 hover:border-slate-300">
              ⏸ Pause
            </button>
          ) : (
            <button onClick={start}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-white"
              style={{ background: COLOR }}>
              ▶ {remaining === seconds ? 'Start' : 'Resume'}
            </button>
          )
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 text-xs font-semibold">
            ⏰ Time's Up!
          </div>
        )}
        <button onClick={reset} className="px-2.5 py-1.5 rounded-lg border text-xs text-slate-400 hover:text-slate-600 border-slate-200 bg-white">↺</button>
      </div>

      {/* Progress bar */}
      {showProgress && (
        <div className="w-full max-w-32 h-1 bg-slate-100 rounded-full overflow-hidden">
          <div style={{ width: `${pct}%`, background: COLOR, height: '100%', borderRadius: '100px', transition: 'width 1s linear, background 0.3s ease' }}/>
        </div>
      )}
    </div>
  )
}
