import { useEffect, useState } from 'react'

export default function ScoreRing({ score = 0, size = 120, strokeWidth = 8, label = 'Score', animated = true }) {
  const [displayScore, setDisplayScore] = useState(0)
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const pct = Math.round(displayScore * 100)
  const offset = circumference - (displayScore / 1) * circumference

  useEffect(() => {
    if (!animated) { setDisplayScore(score); return }
    const start = Date.now()
    const duration = 1400
    const from = 0
    const to = score
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplayScore(from + (to - from) * ease)
      if (t < 1) requestAnimationFrame(tick)
    }
    const timer = setTimeout(() => requestAnimationFrame(tick), 200)
    return () => clearTimeout(timer)
  }, [score, animated])

  const color = pct >= 80 ? '#10B981' : pct >= 60 ? '#6366F1' : pct >= 40 ? '#F59E0B' : '#F43F5E'
  const trackColor = pct >= 80 ? '#D1FAE5' : pct >= 60 ? '#E0E7FF' : pct >= 40 ? '#FEF3C7' : '#FFE4E6'
  const bgGlow = pct >= 80 ? 'rgba(16,185,129,0.1)' : pct >= 60 ? 'rgba(99,102,241,0.1)' : pct >= 40 ? 'rgba(245,158,11,0.1)' : 'rgba(244,63,94,0.1)'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Glow background */}
        <div
          className="absolute inset-0 rounded-full transition-colors duration-700"
          style={{ background: `radial-gradient(circle, ${bgGlow} 0%, transparent 70%)` }}
        />
        <svg width={size} height={size} className="-rotate-90">
          {/* Track */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={trackColor}
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1), stroke 0.4s ease',
              filter: `drop-shadow(0 0 6px ${color}80)`,
            }}
          />
          {/* Dot markers at 25, 50, 75 */}
          {[0.25, 0.5, 0.75].map(mark => {
            const angle = mark * 2 * Math.PI - Math.PI / 2
            const mx = size / 2 + radius * Math.cos(angle)
            const my = size / 2 + radius * Math.sin(angle)
            return (
              <circle key={mark} cx={mx} cy={my} r={2} fill="#E0E7FF"
                style={{ transform: 'rotate(90deg)', transformOrigin: `${size/2}px ${size/2}px` }}
              />
            )
          })}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-display font-700 leading-none transition-colors duration-500"
            style={{ fontSize: size * 0.22, color }}
          >
            {pct}%
          </span>
        </div>
      </div>
      {label && <p className="text-2xs font-mono font-600 text-ink-400 uppercase tracking-widest">{label}</p>}
    </div>
  )
}
