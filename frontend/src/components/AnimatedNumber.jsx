// AnimatedNumber component
import { useEffect, useState } from 'react'

export function AnimatedNumber({ value = 0, duration = 1200, prefix = '', suffix = '' }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const n = typeof value === 'number' ? value : parseFloat(value) || 0
    const start = Date.now()
    const tick = () => {
      const t = Math.min((Date.now() - start) / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(n * ease))
      if (t < 1) requestAnimationFrame(tick)
    }
    const timer = setTimeout(() => requestAnimationFrame(tick), 100)
    return () => clearTimeout(timer)
  }, [value, duration])
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{prefix}{display.toLocaleString()}{suffix}</span>
}

// AnimatedBar component
export function AnimatedBar({ value = 0, color = '#6366F1', delay = 0, height = 8, showLabel = false, label = '' }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setWidth(value), 150 + delay)
    return () => clearTimeout(t)
  }, [value, delay])

  const colors = {
    '#6366F1': { bg: '#EEF2FF', fill: 'linear-gradient(90deg, #818CF8, #6366F1)', glow: 'rgba(99,102,241,0.2)' },
    '#10B981': { bg: '#ECFDF5', fill: 'linear-gradient(90deg, #34D399, #10B981)', glow: 'rgba(16,185,129,0.2)' },
    '#F59E0B': { bg: '#FFFBEB', fill: 'linear-gradient(90deg, #FBBF24, #F59E0B)', glow: 'rgba(245,158,11,0.2)' },
    '#F43F5E': { bg: '#FFF1F2', fill: 'linear-gradient(90deg, #FB7185, #F43F5E)', glow: 'rgba(244,63,94,0.2)' },
    '#0EA5E9': { bg: '#F0F9FF', fill: 'linear-gradient(90deg, #38BDF8, #0EA5E9)', glow: 'rgba(14,165,233,0.2)' },
    '#8B5CF6': { bg: '#EDE9FE', fill: 'linear-gradient(90deg, #A78BFA, #8B5CF6)', glow: 'rgba(139,92,246,0.2)' },
  }
  const style = colors[color] || colors['#6366F1']

  return (
    <div>
      {showLabel && (
        <div className="flex justify-between mb-1.5">
          <span className="text-xs font-500 text-ink-600 font-body capitalize">{label}</span>
          <span className="text-xs font-mono font-600" style={{ color }}>{value}%</span>
        </div>
      )}
      <div
        className="rounded-full overflow-hidden"
        style={{ height, background: style.bg }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${width}%`,
            background: style.fill,
            boxShadow: `0 2px 8px ${style.glow}`,
            transition: `width 1.2s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
          }}
        />
      </div>
    </div>
  )
}
