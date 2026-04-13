import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export default function ScoreGauge({ score = 0, maxScore = 10, size = 160, label = 'Score', showGrade = true }) {
  const [animated, setAnimated] = useState(0)
  const pct = Math.round((animated / maxScore) * 100)
  const radius = (size / 2) - 14
  const circumference = 2 * Math.PI * radius
  // Gauge goes from 210° to -30° (240° arc)
  const arcLength = (240 / 360) * circumference
  const offset = arcLength - (animated / maxScore) * arcLength

  useEffect(() => {
    const timer = setTimeout(() => {
      const start = Date.now()
      const duration = 1600
      const tick = () => {
        const t = Math.min((Date.now() - start) / duration, 1)
        const ease = 1 - Math.pow(1 - t, 4)
        setAnimated(parseFloat((score * ease).toFixed(2)))
        if (t < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, 300)
    return () => clearTimeout(timer)
  }, [score])

  const getColor = (pct) => {
    if (pct >= 90) return { stroke: '#10B981', glow: 'rgba(16,185,129,0.3)', text: '#059669', bg: '#ECFDF5' }
    if (pct >= 70) return { stroke: '#6366F1', glow: 'rgba(99,102,241,0.3)', text: '#4F46E5', bg: '#EEF2FF' }
    if (pct >= 50) return { stroke: '#F59E0B', glow: 'rgba(245,158,11,0.3)', text: '#D97706', bg: '#FFFBEB' }
    return { stroke: '#F43F5E', glow: 'rgba(244,63,94,0.3)', text: '#E11D48', bg: '#FFF1F2' }
  }

  const getGrade = (pct) => {
    if (pct >= 95) return 'A+'
    if (pct >= 90) return 'A'
    if (pct >= 80) return 'B+'
    if (pct >= 70) return 'B'
    if (pct >= 60) return 'C'
    if (pct >= 50) return 'D'
    return 'F'
  }

  const color = getColor(pct)
  const grade = getGrade(pct)

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(150deg)' }}>
          <defs>
            <filter id={`glow-${size}`}>
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          {/* Background arc */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={0}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke={color.stroke}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={offset}
            filter={`url(#glow-${size})`}
            style={{ transition: 'stroke-dashoffset 0.05s linear, stroke 0.5s ease' }}
          />
          {/* Tick marks */}
          {[...Array(11)].map((_, i) => {
            const angle = (210 + (240 / 10) * i) * (Math.PI / 180)
            const inner = radius - 12
            const outer = radius - 4
            return (
              <line
                key={i}
                x1={size / 2 + inner * Math.cos(angle)}
                y1={size / 2 + inner * Math.sin(angle)}
                x2={size / 2 + outer * Math.cos(angle)}
                y2={size / 2 + outer * Math.sin(angle)}
                stroke={i <= Math.round(animated) ? color.stroke : '#CBD5E1'}
                strokeWidth={2}
                strokeLinecap="round"
                style={{ transition: 'stroke 0.3s ease' }}
              />
            )
          })}
        </svg>

        {/* Center content */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 12 }}>
          <motion.div
            key={Math.floor(animated)}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400 }}
            style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: size * 0.24, color: color.text, lineHeight: 1 }}
          >
            {animated.toFixed(1)}
          </motion.div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#94A3B8', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
            / {maxScore}
          </div>
          {showGrade && (
            <div style={{ marginTop: 6, padding: '2px 10px', borderRadius: 20, background: color.bg, color: color.text, fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 13 }}>
              {grade}
            </div>
          )}
        </div>
      </div>
      {label && (
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {label}
        </p>
      )}
    </div>
  )
}
