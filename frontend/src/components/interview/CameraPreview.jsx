import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function CameraPreview({ onEvent, enabled = true, compact = false }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [faceStatus, setFaceStatus] = useState('checking') // checking | detected | missing | multiple
  const [mirrorMode, setMirrorMode] = useState(true)

  // Start camera
  const startCamera = useCallback(async () => {
    if (!enabled) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
          setCameraReady(true)
          setFaceStatus('detected')
        }
      }
    } catch (err) {
      setCameraError(err.message.includes('Permission') ? 'Camera permission denied' : 'Camera not available')
    }
  }, [enabled])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraReady(false)
  }, [])

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [startCamera, stopCamera])

  // Simulate periodic face checks (replace with face-api.js in production)
  useEffect(() => {
    if (!cameraReady) return
    const interval = setInterval(() => {
      // In production: use face-api.js TinyFaceDetector here
      // For now, simulate with random status changes (mostly detected)
      const rand = Math.random()
      if (rand > 0.92) {
        setFaceStatus('missing')
        onEvent?.({ event_type: 'no_face', severity: 'medium', timestamp: new Date().toISOString() })
      } else {
        setFaceStatus('detected')
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [cameraReady, onEvent])

  const STATUS_COLORS = {
    checking:  { border: 'border-slate-300', dot: 'bg-slate-400', text: 'text-slate-500', label: 'Initializing...' },
    detected:  { border: 'border-emerald-400', dot: 'bg-emerald-500', text: 'text-emerald-600', label: 'Face Detected ✓' },
    missing:   { border: 'border-rose-400', dot: 'bg-rose-500', text: 'text-rose-600', label: 'No Face Detected ⚠' },
    multiple:  { border: 'border-amber-400', dot: 'bg-amber-500', text: 'text-amber-600', label: 'Multiple Faces ⚠' },
  }
  const statusCfg = STATUS_COLORS[faceStatus]

  if (compact) {
    return (
      <div className="relative w-32 h-24 rounded-xl overflow-hidden border-2 bg-slate-900 shrink-0" style={{ borderColor: faceStatus === 'detected' ? '#34D399' : '#F87171' }}>
        {cameraReady ? (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"
            style={{ transform: mirrorMode ? 'scaleX(-1)' : 'none' }}/>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500">
            {cameraError ? '📷✕' : '⏳'}
          </div>
        )}
        <div className="absolute top-1.5 right-1.5">
          <div className={`w-2.5 h-2.5 rounded-full ${statusCfg.dot}`} style={{ boxShadow: faceStatus === 'detected' ? '0 0 6px rgba(52,211,153,0.7)' : 'none' }}/>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Camera feed */}
      <div className={`relative rounded-2xl overflow-hidden bg-slate-900 border-2 ${statusCfg.border} transition-colors duration-500`}
        style={{ aspectRatio: '4/3' }}>
        {cameraReady ? (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"
              style={{ transform: mirrorMode ? 'scaleX(-1)' : 'none' }}/>
            {/* Corner brackets */}
            {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map((pos, i) => (
              <div key={i} className={`absolute ${pos} w-5 h-5`}
                style={{ borderColor: faceStatus === 'detected' ? '#34D399' : '#F87171',
                  borderStyle: 'solid', borderWidth: 0,
                  ...(i === 0 ? { borderTopWidth: 2, borderLeftWidth: 2 } : {}),
                  ...(i === 1 ? { borderTopWidth: 2, borderRightWidth: 2 } : {}),
                  ...(i === 2 ? { borderBottomWidth: 2, borderLeftWidth: 2 } : {}),
                  ...(i === 3 ? { borderBottomWidth: 2, borderRightWidth: 2 } : {}),
                  borderRadius: 3,
                }}
              />
            ))}
            {/* Scan line animation */}
            {faceStatus !== 'detected' && (
              <motion.div
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
                className="absolute left-0 right-0 h-0.5 opacity-60"
                style={{ background: faceStatus === 'missing' ? '#F43F5E' : '#F59E0B' }}
              />
            )}
            {/* REC indicator */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm">
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"/>
              <span className="text-white text-xs font-mono font-600">REC</span>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            {cameraError ? (
              <>
                <div className="text-4xl">📷</div>
                <p className="text-slate-400 text-sm font-medium font-body text-center px-4">{cameraError}</p>
                <button onClick={startCamera} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
                  Try Again
                </button>
              </>
            ) : (
              <>
                <div className="w-10 h-10 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"/>
                <p className="text-slate-400 text-sm">Starting camera...</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-2 text-xs font-medium ${statusCfg.text}`}>
          <div className={`w-2 h-2 rounded-full ${statusCfg.dot} animate-pulse`}/>
          {statusCfg.label}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMirrorMode(m => !m)}
            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition-all font-mono">
            {mirrorMode ? '↔ Mirror' : '↔ Normal'}
          </button>
          <button onClick={() => cameraReady ? stopCamera() : startCamera()}
            className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition-all">
            {cameraReady ? '⏹ Stop' : '▶ Start'}
          </button>
        </div>
      </div>

      {/* Warning overlay */}
      <AnimatePresence>
        {(faceStatus === 'missing' || faceStatus === 'multiple') && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className={`px-4 py-3 rounded-xl border text-sm font-medium flex items-center gap-2
              ${faceStatus === 'missing' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}
          >
            <span>{faceStatus === 'missing' ? '⚠️' : '👥'}</span>
            <span>
              {faceStatus === 'missing' ? 'Please ensure your face is visible in the camera.' : 'Multiple faces detected. Please ensure only you are visible.'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
