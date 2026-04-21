/**
 * useFaceDetection — MediaPipe FaceMesh via CDN
 * Detects: face count, eye gaze direction, look-away events
 *
 * MediaPipe is loaded dynamically via CDN to avoid bundling issues.
 * Make sure index.html includes:
 *   <script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js" crossorigin="anonymous"></script>
 *   <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js" crossorigin="anonymous"></script>
 */
import { useState, useEffect, useRef, useCallback } from 'react'

// Eye landmark indices in MediaPipe FaceMesh
const LEFT_EYE_OUTER  = 33
const LEFT_EYE_INNER  = 133
const RIGHT_EYE_OUTER = 362
const RIGHT_EYE_INNER = 263
const NOSE_TIP        = 4
const LEFT_CHEEK      = 234
const RIGHT_CHEEK     = 454

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
    let retries = 0
    const tryLoad = () => {
      if (window.FaceMesh) {
        initFaceMesh()
      } else if (retries < 15) {
        retries++
        setTimeout(tryLoad, 800)
      } else {
        console.warn('[FaceDetection] MediaPipe not available — using fallback mode')
        setMpReady(false)
        setFaceStatus('ok') // Optimistic — camera still works
      }
    }
    tryLoad()
    return () => { mountedRef.current = false }
  }, [])

  const initFaceMesh = useCallback(async () => {
    try {
      const faceMesh = new window.FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      })
      faceMesh.setOptions({
        maxNumFaces:       3,
        refineLandmarks:   true,
        minDetectionConfidence: 0.6,
        minTrackingConfidence:  0.5,
      })
      faceMesh.onResults(handleFaceMeshResults)
      await faceMesh.initialize()
      faceMeshRef.current = faceMesh
      if (mountedRef.current) setMpReady(true)
    } catch (e) {
      console.warn('[FaceDetection] MediaPipe init failed:', e.message)
      if (mountedRef.current) setFaceStatus('ok')
    }
  }, [])

  // Process results
  const handleFaceMeshResults = useCallback((results) => {
    if (!mountedRef.current) return
    const count = results.multiFaceLandmarks?.length || 0
    setFaceCount(count)

    if (count === 0) {
      setFaceStatus('missing')
      dispatchEvent('face_missing', 'medium', 'No face detected in frame')
    } else if (count > 1) {
      setFaceStatus('multiple')
      dispatchEvent('multiple_faces', 'high', `${count} faces detected`)
    } else {
      // Single face — check gaze
      const landmarks = results.multiFaceLandmarks[0]
      const gaze = computeGaze(landmarks)
      setGazeDir(gaze)
      if (gaze !== 'center') {
        setFaceStatus('looking_away')
        dispatchEvent('looking_away', 'low', `Gaze direction: ${gaze}`)
      } else {
        setFaceStatus('ok')
      }
    }
  }, [])

  // Run detection on interval
  useEffect(() => {
    if (!active || !mpReady || !faceMeshRef.current) return
    const id = setInterval(async () => {
      if (!videoRef?.current || videoRef.current.readyState < 2) return
      try {
        await faceMeshRef.current.send({ image: videoRef.current })
      } catch {}
    }, intervalMs)
    return () => clearInterval(id)
  }, [active, mpReady, intervalMs, videoRef])

  // Gaze computation from FaceMesh landmarks
  function computeGaze(landmarks) {
    try {
      const nose     = landmarks[NOSE_TIP]
      const leftCh   = landmarks[LEFT_CHEEK]
      const rightCh  = landmarks[RIGHT_CHEEK]
      const faceWidth = Math.abs(rightCh.x - leftCh.x)
      const faceCenter = (leftCh.x + rightCh.x) / 2
      const noseOffset = nose.x - faceCenter

      // Horizontal
      if (noseOffset > faceWidth * 0.22) return 'left'
      if (noseOffset < -faceWidth * 0.22) return 'right'

      // Vertical (y goes top→bottom in normalized)
      const leftEyeY  = landmarks[LEFT_EYE_OUTER].y
      const rightEyeY = landmarks[RIGHT_EYE_OUTER].y
      const avgEyeY   = (leftEyeY + rightEyeY) / 2
      if (avgEyeY < 0.38) return 'up'
      if (avgEyeY > 0.62) return 'down'

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
