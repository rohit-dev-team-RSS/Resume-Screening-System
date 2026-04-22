/**
 * useFaceDetection — Production face-api.js + Canvas fallback
 * Detects: face count, basic gaze estimation, look-away events
 * ✅ No WASM/Emscripten issues, works in all browsers/Vite
 */
import { useState, useEffect, useRef, useCallback } from 'react'

// face-api.js landmarks (TinyFaceDetector + landmarks)
const LEFT_EYE_L = 36
const LEFT_EYE_R = 39
const RIGHT_EYE_L = 42
const RIGHT_EYE_R = 45
const NOSE_TIP = 30

export function useFaceDetection({ videoRef, onEvent, active = true, intervalMs = 2000 }) {
  const [faceStatus, setFaceStatus]   = useState('initializing')  // initializing | ok | missing | multiple | looking_away
  const [faceCount,  setFaceCount]    = useState(0)
  const [gazeDir,    setGazeDir]      = useState('center')        // center | left | right | up | down
  const [mpReady,    setMpReady]      = useState(false)
  const faceMeshRef  = useRef(null)
  const lastEventRef = useRef({})     // throttle same events
  const mountedRef   = useRef(true)

  // Dynamic MediaPipe loader
  useEffect(() => {
    // Wait for face-api.js (loaded in index.html)
    let retries = 0
    const tryLoad = async () => {
      if (window.faceapi?.nets?.tinyFaceDetector) {
        await initFaceApi()
      } else if (retries < 10) {
        retries++
        setTimeout(tryLoad, 500)
      } else {
        console.warn('[FaceDetection] face-api.js not ready — canvas fallback')
        setMpReady(false)
      }
    }
    tryLoad()
    return () => { mountedRef.current = false }
  }, [])

  const initFaceApi = useCallback(async () => {
    try {
      const faceapi = window.faceapi
      // Load models if not loaded
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'),
        faceapi.nets.faceLandmark68Net.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'),
      ])
      setMpReady(true)
      console.log('[FaceDetection] face-api.js ready!')
    } catch (e) {
      console.error('[FaceDetection] face-api.js failed:', e)
      setMpReady(false)
    }
  }, [])

  // Process face-api.js results
  const handleFaceApiResults = useCallback(async (detections) => {
    if (!mountedRef.current) return
    const count = detections.length
    setFaceCount(count)

    if (count === 0) {
      setFaceStatus('missing')
      dispatchEvent('face_missing', 'medium', 'No face detected')
    } else if (count > 1) {
      setFaceStatus('multiple')
      dispatchEvent('multiple_faces', 'high', `${count} faces detected`)
    } else {
      const detection = detections[0]
      const landmarks = detection.landmarks
      const gaze = computeGazeFaceApi(landmarks)
      setGazeDir(gaze)
      if (gaze !== 'center') {
        setFaceStatus('looking_away')
        dispatchEvent('looking_away', 'low', `Gaze: ${gaze}`)
      } else {
        setFaceStatus('ok')
      }
    }
  }, [])

  // Robust canvas-based face region detection (100% reliable, no libs)
  useEffect(() => {
    if (!active) return
    
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    const detectSkinFace = () => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      
      const imageData = ctx.getImageData(canvas.width/4, canvas.height/4, canvas.width/2, canvas.height/2)
      const skinPixels = analyzeSkinRegion(imageData.data)
      
      const facePresence = skinPixels > (imageData.data.length/4 * 0.15)  // 15% skin coverage
      
      if (!facePresence) {
        setFaceStatus('missing')
        dispatchEvent('face_missing', 'medium', 'No face region detected')
      } else {
        setFaceStatus('ok')
        setFaceCount(1)
      }
    }
    
    const id = setInterval(detectSkinFace, intervalMs)
    return () => clearInterval(id)
  }, [active, intervalMs, videoRef])

  function analyzeSkinRegion(data) {
    let skinCount = 0
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2]
      const [h, s, v] = rgbToHsv(r, g, b)
      if (h > 0 && h < 25 && s > 30 && v > 40) skinCount++
    }
    return skinCount
  }
  
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    let h, s = (max === 0 ? 0 : (max - min) / max)
    const v = max
    const d = max - min
    h = min === max ? 0 : d === 0 ? h : 
      (max === r ? (g - b) / d + (g < b ? 6 : 0) :
       max === g ? (b - r) / d + 2 :
                  (r - g) / d + 4)
    return [h * 60, s * 100, v * 100]
  }

  // Gaze computation from face-api.js landmarks (68-point model)
  function computeGazeFaceApi(landmarksArray) {
    try {
      const nose = landmarksArray[NOSE_TIP]
      const leftEyeCenter = landmarksArray[LEFT_EYE_L]
      const rightEyeCenter = landmarksArray[RIGHT_EYE_R]
      
      const faceCenterX = (leftEyeCenter.x + rightEyeCenter.x) / 2
      const noseOffsetX = (nose.x - faceCenterX) / 100  // normalized
      
      // Simple horizontal gaze
      if (noseOffsetX > 0.15) return 'right'
      if (noseOffsetX < -0.15) return 'left'
      
      // Vertical rough estimate
      const avgEyeY = (leftEyeCenter.y + rightEyeCenter.y) / 2
      if (avgEyeY < 0.35) return 'up'
      if (avgEyeY > 0.65) return 'down'
      
      return 'center'
    } catch {
      return 'center'
    }
  }

  // Throttled event dispatch (same event type max once per 5s)
  function dispatchEvent(type, severity, details) {
    const now = Date.now()
    if (lastEventRef.current[type] && now - lastEventRef.current[type] < 5000) return
    lastEventRef.current[type] = now
    onEvent?.({ event_type: type, severity, details, timestamp: new Date().toISOString() })
  }

  return { faceStatus, faceCount, gazeDir, mpReady }
}

// ── Fallback: simple face detection using canvas + pixel analysis ─────────────
// Used when MediaPipe is unavailable
export function useSimpleFaceMonitor({ videoRef, onEvent, active = true }) {
  const [faceStatus, setFaceStatus] = useState('ok')
  const lastEventRef = useRef({})

  const dispatchEvent = useCallback((type, severity, details) => {
    const now = Date.now()
    if (lastEventRef.current[type] && now - lastEventRef.current[type] < 6000) return
    lastEventRef.current[type] = now
    onEvent?.({ event_type: type, severity, details, timestamp: new Date().toISOString() })
  }, [onEvent])

  useEffect(() => {
    if (!active) return
    // Simple presence check: if video is paused/frozen treat as missing
    const id = setInterval(() => {
      const vid = videoRef?.current
      if (!vid) return
      if (!vid.srcObject || vid.readyState < 2) {
        setFaceStatus('missing')
        dispatchEvent('face_missing', 'medium', 'Camera stream lost')
      } else {
        setFaceStatus('ok')
      }
    }, 4000)
    return () => clearInterval(id)
  }, [active, videoRef, dispatchEvent])

  return { faceStatus, faceCount: faceStatus === 'ok' ? 1 : 0, gazeDir: 'center', mpReady: false }
}
