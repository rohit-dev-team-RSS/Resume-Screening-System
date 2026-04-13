/**
 * useSpeech — Speech-to-text input + text-to-speech output
 * Uses Web Speech API (Chrome/Edge native, no API key needed)
 */
import { useState, useEffect, useRef, useCallback } from 'react'

// ── Speech-to-Text ────────────────────────────────────────────────────────────
export function useSpeechToText({ onTranscript, onFinalTranscript, language = 'en-US' } = {}) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [supported, setSupported] = useState(false)
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      setSupported(true)
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = language
      recognition.maxAlternatives = 1

      recognition.onresult = (event) => {
        let interim = ''
        let final = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const text = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            final += text + ' '
          } else {
            interim += text
          }
        }
        if (final) {
          setTranscript(prev => prev + final)
          onFinalTranscript?.(final.trim())
        }
        onTranscript?.(interim)
      }

      recognition.onerror = (event) => {
        setError(event.error)
        setListening(false)
        if (event.error === 'not-allowed') {
          setError('Microphone permission denied')
        }
      }

      recognition.onend = () => {
        setListening(false)
      }

      recognitionRef.current = recognition
    }
  }, [language])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return
    setError(null)
    setListening(true)
    try {
      recognitionRef.current.start()
    } catch (e) {
      // Already started
    }
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const resetTranscript = useCallback(() => setTranscript(''), [])

  const toggleListening = useCallback(() => {
    if (listening) stopListening()
    else startListening()
  }, [listening, startListening, stopListening])

  return { listening, transcript, supported, error, startListening, stopListening, toggleListening, resetTranscript }
}

// ── Text-to-Speech ────────────────────────────────────────────────────────────
export function useTextToSpeech({ rate = 0.9, pitch = 1, volume = 1, lang = 'en-US' } = {}) {
  const [speaking, setSpeaking] = useState(false)
  const [supported, setSupported] = useState(false)
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState(null)
  const utteranceRef = useRef(null)

  useEffect(() => {
    if ('speechSynthesis' in window) {
      setSupported(true)
      const loadVoices = () => {
        const available = window.speechSynthesis.getVoices()
        setVoices(available)
        // Prefer natural English voices
        const preferred = available.find(v => v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Alex') || (v.lang.startsWith('en') && v.localService))
        setSelectedVoice(preferred || available[0] || null)
      }
      loadVoices()
      window.speechSynthesis.onvoiceschanged = loadVoices
    }
  }, [])

  const speak = useCallback((text, options = {}) => {
    if (!supported || !text) return

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = options.rate ?? rate
    utterance.pitch = options.pitch ?? pitch
    utterance.volume = options.volume ?? volume
    utterance.lang = options.lang ?? lang
    if (options.voice ?? selectedVoice) {
      utterance.voice = options.voice ?? selectedVoice
    }

    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => {
      setSpeaking(false)
      options.onEnd?.()
    }
    utterance.onerror = () => setSpeaking(false)

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [supported, rate, pitch, volume, lang, selectedVoice])

  const stop = useCallback(() => {
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const pause = useCallback(() => window.speechSynthesis.pause(), [])
  const resume = useCallback(() => window.speechSynthesis.resume(), [])

  return { speak, stop, pause, resume, speaking, supported, voices, selectedVoice, setSelectedVoice }
}

// ── Combined hook for interview use ──────────────────────────────────────────
export function useInterviewVoice({ onAnswerUpdate } = {}) {
  const [voiceAnswer, setVoiceAnswer] = useState('')

  const stt = useSpeechToText({
    onFinalTranscript: (text) => {
      setVoiceAnswer(prev => {
        const updated = prev + (prev ? ' ' : '') + text
        onAnswerUpdate?.(updated)
        return updated
      })
    },
  })

  const tts = useTextToSpeech({ rate: 0.85, pitch: 1 })

  const askQuestion = useCallback((question) => {
    tts.stop()
    tts.speak(question, { onEnd: () => stt.startListening() })
  }, [tts, stt])

  const clearVoiceAnswer = useCallback(() => {
    setVoiceAnswer('')
    stt.resetTranscript()
  }, [stt])

  return { ...stt, ...tts, voiceAnswer, askQuestion, clearVoiceAnswer }
}
