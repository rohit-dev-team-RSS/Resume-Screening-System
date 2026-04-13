import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function CheatingAlert({ onEvent, active = true }) {
  const [alerts, setAlerts] = useState([])
  const [eventLog, setEventLog] = useState([])
  const [totalEvents, setTotalEvents] = useState(0)
  const alertIdRef = useRef(0)

  const pushAlert = useCallback((type, message, severity = 'medium') => {
    const id = ++alertIdRef.current
    const event = { event_type: type, severity, timestamp: new Date().toISOString(), details: message }

    setAlerts(prev => [...prev.slice(-2), { id, message, severity, type }])
    setEventLog(prev => [...prev, event])
    setTotalEvents(n => n + 1)
    onEvent?.(event)

    // Auto-dismiss
    setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== id)), 5000)
  }, [onEvent])

  // ── Tab Visibility Detection ─────────────────────────────────────────────
  useEffect(() => {
    if (!active) return
    const handleVisibility = () => {
      if (document.hidden) pushAlert('tab_switch', 'You left the interview tab!', 'high')
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [active, pushAlert])

  // ── Window Blur/Focus ────────────────────────────────────────────────────
  useEffect(() => {
    if (!active) return
    let blurCount = 0
    const handleBlur = () => {
      blurCount++
      if (blurCount > 1) pushAlert('window_blur', 'Interview window lost focus', 'medium')
    }
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [active, pushAlert])

  // ── Copy-Paste Detection ─────────────────────────────────────────────────
  useEffect(() => {
    if (!active) return
    const handlePaste = (e) => {
      const text = e.clipboardData?.getData('text') || ''
      if (text.length > 20) pushAlert('copy_paste', `Paste detected (${text.length} chars)`, 'high')
    }
    const handleContextMenu = (e) => {
      pushAlert('right_click', 'Right-click detected', 'low')
    }
    document.addEventListener('paste', handlePaste)
    document.addEventListener('contextmenu', handleContextMenu)
    return () => {
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [active, pushAlert])

  // ── DevTools Detection ───────────────────────────────────────────────────
  useEffect(() => {
    if (!active) return
    const threshold = 160
    let devtoolsOpen = false
    const check = () => {
      const isOpen = window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold
      if (isOpen && !devtoolsOpen) {
        devtoolsOpen = true
        pushAlert('devtools_open', 'Browser DevTools detected!', 'critical')
      } else if (!isOpen) { devtoolsOpen = false }
    }
    const interval = setInterval(check, 2000)
    return () => clearInterval(interval)
  }, [active, pushAlert])

  const getRiskColor = (count) => {
    if (count === 0) return { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Clean' }
    if (count <= 2) return { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Low Risk' }
    if (count <= 5) return { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', label: 'Medium Risk' }
    return { text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', label: 'High Risk' }
  }

  const riskCfg = getRiskColor(totalEvents)
  const severityStyle = { low: 'bg-blue-50 border-blue-200 text-blue-700', medium: 'bg-amber-50 border-amber-200 text-amber-700', high: 'bg-orange-50 border-orange-200 text-orange-700', critical: 'bg-rose-50 border-rose-200 text-rose-700' }

  return (
    <div className="space-y-3">
      {/* Integrity status chip */}
      <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${riskCfg.bg} ${riskCfg.border}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${totalEvents === 0 ? 'bg-emerald-500' : 'bg-amber-500'} ${totalEvents > 0 ? 'animate-pulse' : ''}`}/>
          <span className={`text-xs font-semibold font-mono ${riskCfg.text}`}>Session Integrity</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold font-mono ${riskCfg.text}`}>{riskCfg.label}</span>
          {totalEvents > 0 && (
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${riskCfg.bg} ${riskCfg.text} border ${riskCfg.border}`}>
              {totalEvents} flag{totalEvents > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Live alerts */}
      <div className="space-y-2 min-h-0">
        <AnimatePresence>
          {alerts.map(alert => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 20, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-medium ${severityStyle[alert.severity]}`}
            >
              <span className="shrink-0 mt-0.5">
                {alert.severity === 'critical' ? '🚨' : alert.severity === 'high' ? '⚠️' : alert.severity === 'medium' ? '⚡' : 'ℹ️'}
              </span>
              <div className="flex-1">
                <span className="font-semibold capitalize">{alert.type.replace(/_/g, ' ')}</span>
                <span className="ml-1 opacity-80">— {alert.message}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Event counter */}
      {totalEvents > 0 && (
        <div className="text-2xs font-mono text-slate-400 text-right">
          {totalEvents} integrity event{totalEvents > 1 ? 's' : ''} recorded this session
        </div>
      )}
    </div>
  )
}

// Expose event log for parent components
CheatingAlert.useEventLog = () => {
  const [events, setEvents] = useState([])
  const addEvent = useCallback((e) => setEvents(prev => [...prev, e]), [])
  return { events, addEvent }
}
