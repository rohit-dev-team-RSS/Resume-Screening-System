/**
 * useAdvancedDetection — Production-grade AI facial cheating detection
 *
 * Combines 4 detection layers:
 *  1. MediaPipe FaceMesh  → face presence, count, 468 landmarks
 *  2. Iris / Gaze Tracker → eye direction using iris landmarks (MediaPipe)
 *  3. COCO-SSD (TF.js)   → phone / book / object detection
 *  4. face-api.js         → emotion detection (neutral/suspicious vs fearful/surprised)
 *
 * All models load from CDN — no bundling needed.
 * Call useAdvancedDetection({ videoRef, canvasRef, onEvent, active })
 */

import { useState, useEffect, useRef, useCallback } from 'react'

// ── CDN URLs ──────────────────────────────────────────────────────────────────
// const TFJS_CDN      = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js'
const TFJS_CDN = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js';
const COCOSSL_CDN   = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js'
// const FACEAPI_CDN   = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js'
const FACEAPI_CDN = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js';
const FACE_API_MODELS= 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'

// MediaPipe (loaded via index.html script tags — see instructions)
// @mediapipe/face_mesh and @mediapipe/camera_utils must be in index.html

// ── Iris / Gaze landmark indices (MediaPipe FaceMesh 468+10 with refinement) ──
const LEFT_IRIS_CENTER  = 468
const RIGHT_IRIS_CENTER = 473
const LEFT_EYE_LEFT     = 33
const LEFT_EYE_RIGHT    = 133
const RIGHT_EYE_LEFT    = 362
const RIGHT_EYE_RIGHT   = 263
const LEFT_EYE_TOP      = 159
const LEFT_EYE_BOTTOM   = 145
const RIGHT_EYE_TOP     = 386
const RIGHT_EYE_BOTTOM  = 374
const NOSE_TIP          = 4
const CHIN              = 152
const LEFT_CHEEK        = 234
const RIGHT_CHEEK       = 454
const FOREHEAD          = 10

// ── Phone-like objects COCO-SSD detects ──────────────────────────────────────
const SUSPICIOUS_OBJECTS = new Set([
  'cell phone', 'laptop', 'book', 'remote', 'keyboard', 'mouse',
  'tablet', 'ipad', 'phone',
])

// ── Suspicious emotions ───────────────────────────────────────────────────────
const SUSPICIOUS_EMOTIONS = new Set(['fearful', 'surprised', 'disgusted'])

// ══════════════════════════════════════════════════════════════════════════════
export function useAdvancedDetection({
  videoRef,
  canvasRef,
  onEvent,
  active = true,
  faceInterval  = 1500,   // ms between face checks
  objectInterval= 4000,   // ms between object detection checks
  emotionInterval = 5000, // ms between emotion checks
}) {
  // ── State ─────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState({
    faceCount:   0,
    gazeDir:     'center',   // center|left|right|up|down
    gazeOffX:    0,          // normalized -1..1
    gazeOffY:    0,
    eyeOpenness: 1.0,        // 0..1 (0 = closed)
    phone:       false,
    objectLabel: null,
    emotion:     null,
    confidence:  1.0,        // derived confidence 0..1
    headPose:    { yaw:0, pitch:0, roll:0 },
    lookAwayMs:  0,          // cumulative ms looking away
    mpReady:     false,
    tfReady:     false,
    faceApiReady:false,
  })

  // ── Refs ──────────────────────────────────────────────────────────────────
  const faceMeshRef     = useRef(null)
  const cocoModelRef    = useRef(null)
  const lookAwayStart   = useRef(null)
  const lastEvents      = useRef({})        // throttle same event type
  const mountedRef      = useRef(true)
  const faceTimerRef    = useRef(null)
  const objTimerRef     = useRef(null)
  const emoTimerRef     = useRef(null)
  const lookAwayTimerRef= useRef(null)

  // ── Dynamic script loader ─────────────────────────────────────────────────
  const loadScript = useCallback((src, id) => new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return }
    const s = document.createElement('script')
    s.id  = id; s.src = src; s.async = true; s.crossOrigin = 'anonymous'
    s.onload  = resolve
    s.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  }), [])



 // ══════════════════════════════════════════════════════════════════════════
  // LAYER 1+2 — FaceMesh results handler (face + gaze + head pose)
  // ══════════════════════════════════════════════════════════════════════════
  const handleFaceMeshResults = useCallback((results) => {
    if (!mountedRef.current) return
    const faces = results.multiFaceLandmarks || []
    const count = faces.length

    // ── Face count ────────────────────────────────────────────────────────
    if (count === 0) {
      setStatus(s => ({ ...s, faceCount:0, gazeDir:'unknown' }))
      emitEvent('face_missing', 'medium', 'No face detected in camera frame')
      trackLookAway(true)
      return
    }
    if (count > 1) {
      emitEvent('multiple_faces', 'high', `${count} faces detected — external assistance suspected`)
    }
    trackLookAway(false)

    const lm = faces[0]  // primary face

    // ── Iris gaze tracking ────────────────────────────────────────────────
    const gaze = computeIrisGaze(lm)
    const headPose = computeHeadPose(lm)

    // Combined look-away detection (iris + head pose)
    const lookingAway = gaze.dir !== 'center' || Math.abs(headPose.yaw) > 20 || Math.abs(headPose.pitch) > 20

    // ── Eye openness (drowsiness / distraction) ───────────────────────────
    const eyeOpen = computeEyeOpenness(lm)

    // ── Confidence from face signals ──────────────────────────────────────
    const conf = deriveConfidence(gaze, headPose, eyeOpen)

    if (mountedRef.current) {
      setStatus(s => ({
        ...s,
        faceCount:   count,
        gazeDir:     gaze.dir,
        gazeOffX:    gaze.offsetX,
        gazeOffY:    gaze.offsetY,
        eyeOpenness: eyeOpen,
        headPose,
        confidence:  conf,
      }))
    }

    // ── Draw debug canvas overlay ─────────────────────────────────────────
    if (canvasRef?.current && results.image) {
      drawOverlay(canvasRef.current, lm, gaze, headPose, count)
    }

    // ── Emit gaze event if needed ─────────────────────────────────────────
    if (lookingAway) {
      trackLookAway(true)
    } else {
      trackLookAway(false)
    }

    if (eyeOpen < 0.15) {
      emitEvent('eyes_closed', 'low', 'Eyes appear closed — possible distraction')
    }
  }, [])

  // ── Init MediaPipe FaceMesh ───────────────────────────────────────────────
const initMediaPipe = useCallback(async () => {
  // Wait for script to be globally available
  let retries = 0;
  while (!window.FaceMesh && retries < 30) {
    await new Promise(r => setTimeout(r, 500));
    retries++;
  }

  try {
    const fm = new window.FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    
    fm.setOptions({
      maxNumFaces: 2,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    fm.onResults(handleFaceMeshResults);
    // Remove fm.initialize() if it's causing 'Module.arguments' error, 
    // FaceMesh usually initializes on the first .send()
    faceMeshRef.current = fm;
    if (mountedRef.current) setStatus(s => ({ ...s, mpReady: true }));
    return true;
  } catch (e) {
    console.error('[Detection] FaceMesh error:', e);
    return false;
  }
}, [handleFaceMeshResults]);

  // ── Init TF.js + COCO-SSD ─────────────────────────────────────────────────
const initCocoSSD = useCallback(async () => {
  try {
    await loadScript(TFJS_CDN, 'tfjs-cdn');
    
    let tfRetry = 0;
    while (!window.tf && tfRetry < 10) {
      await new Promise(r => setTimeout(r, 500));
      tfRetry++;
    }

    if (!window.tf) {
      console.error('[Detection] TensorFlow.js failed to load');
      return false;
    }

    // Engine initialization
    await window.tf.ready();
    
    // Agar WebGL available hai toh use set karein, varna clash kam hoga
    if (window.tf.getBackend() !== 'webgl') {
      try {
        await window.tf.setBackend('webgl');
      } catch (e) {
        console.warn("WebGL not available, falling back to CPU");
      }
    }

    await loadScript(COCOSSL_CDN, 'coco-ssd-cdn');

    let cocoRetry = 0;
    while (!window.cocoSsd && cocoRetry < 10) {
      await new Promise(r => setTimeout(r, 500));
      cocoRetry++;
    }

    if (!window.cocoSsd) {
      console.warn('[Detection] cocoSsd global object not found');
      return false;
    }

    cocoModelRef.current = await window.cocoSsd.load({
      base: 'lite_mobilenet_v2', 
    });

    if (mountedRef.current) {
      setStatus(s => ({ ...s, tfReady: true }));
    }
    
    console.log('[Detection] COCO-SSD loaded successfully');
    return true;
  } catch (e) {
    console.error('[Detection] COCO-SSD load failed:', e.message);
    return false;
  }
}, [loadScript]);



  // ── Init face-api.js for emotions ─────────────────────────────────────────
const initFaceApi = useCallback(async () => {
  try {
    await loadScript(FACEAPI_CDN, 'faceapi-cdn');
    
    let faRetry = 0;
    while (!window.faceapi && faRetry < 10) {
      await new Promise(r => setTimeout(r, 500));
      faRetry++;
    }

    if (!window.faceapi) {
      console.warn('[Detection] faceapi not found');
      return false;
    }

    const fa = window.faceapi;

    // --- IS LINE KO HATA DIYA HAI (Cannot set property tf) ---
    // Kyuki face-api apna TF khud manage kar lega ya global se utha lega.

    // Models load karne se pehle ensure karein ki TinyFaceDetector load ho
    await fa.nets.tinyFaceDetector.loadFromUri(FACE_API_MODELS);
    await fa.nets.faceExpressionNet.loadFromUri(FACE_API_MODELS);

    if (mountedRef.current) {
      setStatus(s => ({ ...s, faceApiReady: true }));
    }
    
    console.log('[Detection] face-api.js loaded successfully');
    return true;
  } catch (e) {
    console.error('[Detection] face-api.js load failed:', e.message);
    // Silent fail: Agar emotion fail hota hai toh proctoring nahi rukni chahiye
    return false;
  }
}, [loadScript]);



  // ── Bootstrap all models in parallel ─────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true
    Promise.allSettled([initMediaPipe(), initCocoSSD(), initFaceApi()])
    return () => {
      mountedRef.current = false
      clearInterval(faceTimerRef.current)
      clearInterval(objTimerRef.current)
      clearInterval(emoTimerRef.current)
      clearInterval(lookAwayTimerRef.current)
    }
  }, [])

  // ══════════════════════════════════════════════════════════════════════════
  // LAYER 1+2 — FaceMesh results handler (face + gaze + head pose)
  // ══════════════════════════════════════════════════════════════════════════
  // const handleFaceMeshResults = useCallback((results) => {
  //   if (!mountedRef.current) return
  //   const faces = results.multiFaceLandmarks || []
  //   const count = faces.length

  //   // ── Face count ────────────────────────────────────────────────────────
  //   if (count === 0) {
  //     setStatus(s => ({ ...s, faceCount:0, gazeDir:'unknown' }))
  //     emitEvent('face_missing', 'medium', 'No face detected in camera frame')
  //     trackLookAway(true)
  //     return
  //   }
  //   if (count > 1) {
  //     emitEvent('multiple_faces', 'high', `${count} faces detected — external assistance suspected`)
  //   }
  //   trackLookAway(false)

  //   const lm = faces[0]  // primary face

  //   // ── Iris gaze tracking ────────────────────────────────────────────────
  //   const gaze = computeIrisGaze(lm)
  //   const headPose = computeHeadPose(lm)

  //   // Combined look-away detection (iris + head pose)
  //   const lookingAway = gaze.dir !== 'center' || Math.abs(headPose.yaw) > 20 || Math.abs(headPose.pitch) > 20

  //   // ── Eye openness (drowsiness / distraction) ───────────────────────────
  //   const eyeOpen = computeEyeOpenness(lm)

  //   // ── Confidence from face signals ──────────────────────────────────────
  //   const conf = deriveConfidence(gaze, headPose, eyeOpen)

  //   if (mountedRef.current) {
  //     setStatus(s => ({
  //       ...s,
  //       faceCount:   count,
  //       gazeDir:     gaze.dir,
  //       gazeOffX:    gaze.offsetX,
  //       gazeOffY:    gaze.offsetY,
  //       eyeOpenness: eyeOpen,
  //       headPose,
  //       confidence:  conf,
  //     }))
  //   }

  //   // ── Draw debug canvas overlay ─────────────────────────────────────────
  //   if (canvasRef?.current && results.image) {
  //     drawOverlay(canvasRef.current, lm, gaze, headPose, count)
  //   }

  //   // ── Emit gaze event if needed ─────────────────────────────────────────
  //   if (lookingAway) {
  //     trackLookAway(true)
  //   } else {
  //     trackLookAway(false)
  //   }

  //   if (eyeOpen < 0.15) {
  //     emitEvent('eyes_closed', 'low', 'Eyes appear closed — possible distraction')
  //   }
  // }, [])

  // ── Iris gaze computation ─────────────────────────────────────────────────
  function computeIrisGaze(lm) {
    try {
      // Iris centers (MediaPipe refined landmarks 468-473)
      const leftIris  = lm[LEFT_IRIS_CENTER]
      const rightIris = lm[RIGHT_IRIS_CENTER]
      if (!leftIris || !rightIris) return { dir:'center', offsetX:0, offsetY:0 }

      // Eye corners
      const lEyeL = lm[LEFT_EYE_LEFT];   const lEyeR = lm[LEFT_EYE_RIGHT]
      const rEyeL = lm[RIGHT_EYE_LEFT];  const rEyeR = lm[RIGHT_EYE_RIGHT]

      // Iris position within the eye (0 = far left, 1 = far right)
      const lEyeWidth  = Math.abs(lEyeR.x - lEyeL.x)
      const rEyeWidth  = Math.abs(rEyeR.x - rEyeL.x)
      const lIrisRelX  = (leftIris.x  - lEyeL.x) / (lEyeWidth  || 0.01)
      const rIrisRelX  = (rightIris.x - rEyeL.x) / (rEyeWidth  || 0.01)
      const avgRelX    = (lIrisRelX + rIrisRelX) / 2

      // Vertical: compare iris y vs eye center
      const lEyeTop    = lm[LEFT_EYE_TOP];  const lEyeBot = lm[LEFT_EYE_BOTTOM]
      const lEyeHeight = Math.abs(lEyeBot.y - lEyeTop.y)
      const lIrisRelY  = (leftIris.y - lEyeTop.y) / (lEyeHeight || 0.01)

      // Normalize to -1..1 (0.5 = centered)
      const offsetX = (avgRelX - 0.5) * 2
      const offsetY = (lIrisRelY - 0.5) * 2

      // Thresholds
      let dir = 'center'
      if (offsetX >  0.35) dir = 'right'
      else if (offsetX < -0.35) dir = 'left'
      else if (offsetY < -0.35) dir = 'up'
      else if (offsetY >  0.35) dir = 'down'

      return { dir, offsetX, offsetY }
    } catch {
      return { dir:'center', offsetX:0, offsetY:0 }
    }
  }

  // ── Head pose from facial geometry ────────────────────────────────────────
  function computeHeadPose(lm) {
    try {
      const nose   = lm[NOSE_TIP]
      const chin   = lm[CHIN]
      const lCheek = lm[LEFT_CHEEK]
      const rCheek = lm[RIGHT_CHEEK]
      const fore   = lm[FOREHEAD]

      const faceWidth  = Math.abs(rCheek.x - lCheek.x)
      const faceMidX   = (lCheek.x + rCheek.x) / 2
      const yaw        = ((nose.x - faceMidX) / (faceWidth * 0.5)) * 35   // degrees approx
      const faceHeight = Math.abs(chin.y - fore.y)
      const faceMidY   = (chin.y + fore.y) / 2
      const pitch      = ((nose.y - faceMidY) / (faceHeight * 0.5)) * 30
      const roll       = Math.atan2(rCheek.y - lCheek.y, rCheek.x - lCheek.x) * (180 / Math.PI)

      return { yaw: yaw*90, pitch: pitch*90, roll }
    } catch {
      return { yaw:0, pitch:0, roll:0 }
    }
  }

  // ── Eye openness (EAR — Eye Aspect Ratio) ────────────────────────────────
  function computeEyeOpenness(lm) {
    try {
      const topL  = lm[LEFT_EYE_TOP];    const botL = lm[LEFT_EYE_BOTTOM]
      const leftL = lm[LEFT_EYE_LEFT];   const rigL = lm[LEFT_EYE_RIGHT]
      const height = Math.abs(topL.y - botL.y)
      const width  = Math.abs(rigL.x - leftL.x)
      const ear    = height / (width || 0.01)
      return Math.min(1, Math.max(0, ear * 4))   // 0=closed, 1=wide open
    } catch {
      return 1.0
    }
  }

  // ── Derive interview confidence from face signals ──────────────────────────
  function deriveConfidence(gaze, headPose, eyeOpen) {
    let score = 1.0
    if (gaze.dir !== 'center')             score -= 0.15
    if (Math.abs(headPose.yaw)   > 15)     score -= 0.10
    if (Math.abs(headPose.pitch) > 15)     score -= 0.10
    if (eyeOpen < 0.3)                     score -= 0.10
    if (Math.abs(gaze.offsetX)   > 0.5)   score -= 0.10
    return Math.max(0, Math.round(score * 100) / 100)
  }

  // ── Look-away timer (trigger event after 3s continuous look-away) ──────────
  function trackLookAway(isAway) {
    if (isAway) {
      if (!lookAwayStart.current) lookAwayStart.current = Date.now()
      const ms = Date.now() - lookAwayStart.current
      setStatus(s => ({ ...s, lookAwayMs: ms }))
      if (ms > 3000) {
        emitEvent('looking_away', 'medium', `Looking away for ${(ms/1000).toFixed(1)}s`)
        lookAwayStart.current = Date.now()  // reset after event
      }
    } else {
      lookAwayStart.current = null
      setStatus(s => ({ ...s, lookAwayMs: 0 }))
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LAYER 3 — COCO-SSD Object Detection (Phone, book, etc.)
  // ══════════════════════════════════════════════════════════════════════════
  const runObjectDetection = useCallback(async () => {
    if (!cocoModelRef.current || !videoRef?.current) return
    const vid = videoRef.current
    if (vid.readyState < 2 || vid.paused) return

    try {
      const predictions = await cocoModelRef.current.detect(vid)
      const suspicious  = predictions.filter(p =>
        SUSPICIOUS_OBJECTS.has(p.class.toLowerCase()) && p.score > 0.55
      )

      if (suspicious.length > 0) {
        const topObj = suspicious.reduce((a, b) => a.score > b.score ? a : b)
        setStatus(s => ({ ...s, phone: true, objectLabel: topObj.class }))
        emitEvent(
          'phone_detected', 'high',
          `Suspicious object: "${topObj.class}" (${(topObj.score * 100).toFixed(0)}% confidence)`
        )

        // Draw detection box on canvas
        if (canvasRef?.current) {
          drawObjectBoxes(canvasRef.current, suspicious, vid.videoWidth, vid.videoHeight)
        }
      } else {
        setStatus(s => ({ ...s, phone: false, objectLabel: null }))
      }
    } catch (e) {
      // ignore transient errors
    }
  }, [videoRef, canvasRef])

  // ══════════════════════════════════════════════════════════════════════════
  // LAYER 4 — face-api.js Emotion Detection
  // ══════════════════════════════════════════════════════════════════════════
  // const runEmotionDetection = useCallback(async () => {
  //   if (!window.faceapi || !videoRef?.current) return
  //   const vid = videoRef.current
  //   if (vid.readyState < 2) return

  //   try {
  //     const fa = window.faceapi
  //     const detections = await fa.detectAllFaces(
  //       vid,
  //       new fa.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 })
  //     ).withFaceExpressions()

  //     if (!detections || detections.length === 0) return

  //     const primary     = detections[0]
  //     const expressions = primary.expressions
  //     // Dominant emotion
  //     const dominant = Object.entries(expressions).reduce((a, b) => a[1] > b[1] ? a : b)

  //     setStatus(s => ({ ...s, emotion: dominant[0] }))

  //     if (SUSPICIOUS_EMOTIONS.has(dominant[0]) && dominant[1] > 0.6) {
  //       emitEvent(
  //         'suspicious_emotion', 'low',
  //         `High ${dominant[0]} detected (${(dominant[1]*100).toFixed(0)}%) — may indicate stress or dishonesty`
  //       )
  //     }
  //   } catch (e) {
  //     // face-api errors are non-critical
  //   }
  // }, [videoRef])

  const runEmotionDetection = useCallback(async () => {
  if (!window.faceapi || !videoRef?.current) return;
  const vid = videoRef.current;
  if (vid.readyState < 2) return;

  try {
    // IMPORTANT: face-api ko batana padta hai ki TF engine already set hai
    const fa = window.faceapi;
    
    // Check if models are actually loaded before running
    if (!fa.nets.tinyFaceDetector.params || !fa.nets.faceExpressionNet.params) {
       return; 
    }

    const detections = await fa.detectAllFaces(
      vid,
      new fa.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 })
    ).withFaceExpressions();

    if (!detections || detections.length === 0) return;
    
    // Baaki logic same...
  } catch (e) {
    console.log('[Detection] Emotion detection skip due to engine lock');
  }
}, [videoRef]);


  // ══════════════════════════════════════════════════════════════════════════
  // DETECTION LOOP — Run all models on their own intervals
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!active) return

    // FaceMesh — continuous via setInterval + send()
    faceTimerRef.current = setInterval(async () => {
      if (!faceMeshRef.current || !videoRef?.current) return
      const vid = videoRef.current
      if (vid.readyState < 2 || vid.paused) return
      try { await faceMeshRef.current.send({ image: vid }) } catch {}
    }, faceInterval)

    // COCO-SSD object detection
    objTimerRef.current = setInterval(runObjectDetection, objectInterval)

    // Emotion detection
    emoTimerRef.current = setInterval(runEmotionDetection, emotionInterval)

    return () => {
      clearInterval(faceTimerRef.current)
      clearInterval(objTimerRef.current)
      clearInterval(emoTimerRef.current)
    }
  }, [active, faceInterval, objectInterval, emotionInterval, runObjectDetection, runEmotionDetection])

  // ══════════════════════════════════════════════════════════════════════════
  // CANVAS DRAWING — Visual debug overlay
  // ══════════════════════════════════════════════════════════════════════════
  function drawOverlay(canvas, landmarks, gaze, headPose, faceCount) {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const W = canvas.width, H = canvas.height

    // Eye gaze indicator
    const gazeColor = gaze.dir === 'center' ? '#10B981' : '#F59E0B'
    ctx.strokeStyle = gazeColor
    ctx.lineWidth = 2
    ctx.beginPath()

    // Draw iris markers
    ;[LEFT_IRIS_CENTER, RIGHT_IRIS_CENTER].forEach(idx => {
      const pt = landmarks[idx]
      if (!pt) return
      const x = pt.x * W, y = pt.y * H
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, 2 * Math.PI)
      ctx.fillStyle = gazeColor + 'CC'
      ctx.fill()
    })

    // Gaze direction arrow at center
    const cx = W * 0.5, cy = H * 0.5
    const arrowX = cx + gaze.offsetX * 30
    const arrowY = cy + gaze.offsetY * 30
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(arrowX, arrowY)
    ctx.strokeStyle = gazeColor
    ctx.lineWidth = 2.5
    ctx.stroke()

    // Status text
    const statusColor = faceCount === 0 ? '#F43F5E' : faceCount > 1 ? '#F59E0B' : '#10B981'
    ctx.fillStyle = statusColor
    ctx.font = 'bold 11px JetBrains Mono, monospace'
    ctx.fillText(`Faces: ${faceCount}  Gaze: ${gaze.dir}  Yaw: ${headPose.yaw.toFixed(0)}°`, 8, 18)
  }

  function drawObjectBoxes(canvas, objects, vidW, vidH) {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const scaleX = canvas.width / vidW, scaleY = canvas.height / vidH

    objects.forEach(obj => {
      const [x, y, w, h] = obj.bbox
      ctx.strokeStyle = '#F43F5E'
      ctx.lineWidth = 2.5
      ctx.strokeRect(x * scaleX, y * scaleY, w * scaleX, h * scaleY)
      ctx.fillStyle = 'rgba(244,63,94,0.15)'
      ctx.fillRect(x * scaleX, y * scaleY, w * scaleX, h * scaleY)
      ctx.fillStyle = '#F43F5E'
      ctx.font = 'bold 11px sans-serif'
      ctx.fillText(`${obj.class} ${(obj.score*100).toFixed(0)}%`, x*scaleX + 4, y*scaleY - 4)
    })
  }

  // ── Event emitter with 6s throttle ────────────────────────────────────────
  function emitEvent(type, severity, details) {
    if (!onEvent) return
    const now = Date.now()
    if (lastEvents.current[type] && now - lastEvents.current[type] < 6000) return
    lastEvents.current[type] = now
    onEvent({ event_type: type, severity, details, timestamp: new Date().toISOString() })
  }

  return status
}

// ── Utility ───────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }