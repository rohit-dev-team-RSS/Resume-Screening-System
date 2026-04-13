import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSpeechToText } from '../../hooks/useSpeech'

// Animated waveform bars
function WaveBar({ delay }) {
  return (
    <motion.div
      animate={{ scaleY: [1, 2.5, 1, 1.5, 1] }}
      transition={{ repeat: Infinity, duration: 0.8, delay, ease: 'easeInOut' }}
      className="w-1 rounded-full bg-indigo-500"
      style={{ height: 16, transformOrigin: 'bottom' }}
    />
  )
}

export default function VoiceInput({ onTranscript, disabled = false, compact = false }) {
  const { listening, transcript, supported, error, toggleListening, stopListening } = useSpeechToText({
    onFinalTranscript: (text) => onTranscript?.(text),
  })

  // Auto-stop on unmount
  useEffect(() => () => stopListening(), [])

  if (!supported) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
        <span>🎤</span>
        <span>Voice not supported in this browser</span>
      </div>
    )
  }

  if (compact) {
    return (
      <button
        onClick={toggleListening}
        disabled={disabled}
        title={listening ? 'Stop recording' : 'Start voice input'}
        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 border ${
          listening
            ? 'bg-rose-50 border-rose-300 text-rose-600 shadow-sm'
            : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50'
        } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {listening ? (
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            className="flex items-end gap-0.5"
          >
            {[0, 0.15, 0.3, 0.15, 0].map((d, i) => (
              <WaveBar key={i} delay={d} />
            ))}
          </motion.div>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
          </svg>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <div className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 ${
        listening
          ? 'border-rose-300 bg-rose-50 shadow-lg shadow-rose-100'
          : 'border-slate-200 bg-white hover:border-indigo-200'
      }`}>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleListening}
            disabled={disabled}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 shadow-sm ${
              listening
                ? 'bg-rose-500 text-white shadow-rose-200'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:-translate-y-0.5 active:translate-y-0'}`}
          >
            {listening ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
              </svg>
            )}
          </button>

          <div>
            <p className={`text-sm font-semibold font-body transition-colors ${listening ? 'text-rose-700' : 'text-slate-700'}`}>
              {listening ? 'Recording...' : 'Voice Input'}
            </p>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              {listening ? 'Click stop or speak your answer' : 'Click to start speaking'}
            </p>
          </div>
        </div>

        {/* Live waveform */}
        <AnimatePresence>
          {listening && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-end gap-1 h-8 px-2"
            >
              {[0, 0.1, 0.2, 0.3, 0.15, 0.05, 0.25].map((d, i) => (
                <WaveBar key={i} delay={d} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Live transcript preview */}
      <AnimatePresence>
        {listening && transcript && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-100 text-sm font-body text-indigo-800 italic"
          >
            "{transcript}"
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className="text-xs text-rose-500 font-mono flex items-center gap-1.5">
          <span>⚠</span>{error}
        </p>
      )}

      <p className="text-xs text-slate-400 font-mono">
        💡 Tip: Speak clearly. Your speech will be added to the text answer box.
      </p>
    </div>
  )
}
