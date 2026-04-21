import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

function RealWaveBar({ index, isActive }) {
  const activeHeights = [18, 28, 40, 32, 22, 14];
  const targetHeight = isActive ? activeHeights[index % activeHeights.length] : 6;

  return (
    <motion.div
      className="w-1.5 rounded-full bg-blue-400"
      animate={{ height: targetHeight }}
      transition={{ repeat: isActive ? Infinity : 0, repeatType: "mirror", duration: 0.4 + (index * 0.05) }}
    />
  )
}

export default function AIAvatar({
  question = '',
  onSpeakEnd,
  autoSpeak = true,
  avatarName = 'Alex',
  compact = false,
  videoSource = '/avatar-loop.mp4' 
}) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voicesReady, setVoicesReady] = useState(false)
  const videoRef = useRef(null)
  const currentQuestionRef = useRef("") 

  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        if (window.speechSynthesis.getVoices().length > 0) setVoicesReady(true);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const isActive = isSpeaking;

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [isActive]);

  const speak = useCallback((text) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    utt.voice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha')) || voices[0];

    utt.onstart = () => setIsSpeaking(true);
    utt.onend = () => { setIsSpeaking(false); onSpeakEnd?.(); };
    utt.onerror = () => setIsSpeaking(false);

    setTimeout(() => window.speechSynthesis.speak(utt), 50);
  }, [onSpeakEnd]);

  useEffect(() => {
    if (autoSpeak && question && question !== currentQuestionRef.current && voicesReady) {
      currentQuestionRef.current = question;
      speak(question);
    }
  }, [question, voicesReady, autoSpeak, speak]);

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="relative w-12 h-12 overflow-hidden rounded-xl bg-slate-900">
           <video ref={videoRef} src={videoSource} muted playsInline className="w-full h-full object-cover" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">{avatarName}</p>
          <p className="text-[10px] text-slate-400 uppercase font-mono">{isActive ? 'Speaking' : 'Standby'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <motion.div 
        animate={isActive ? { scale: [1, 1.02, 1] } : {}}
        transition={{ repeat: Infinity, duration: 2 }}
        className="relative w-44 h-44 rounded-full overflow-hidden border-4 border-white shadow-xl bg-slate-900"
      >
        <video ref={videoRef} src={videoSource} muted playsInline loop={isActive} className="w-full h-full object-cover" />
      </motion.div>
      <div className="flex items-center gap-1 h-8">
        {[...Array(8)].map((_, i) => <RealWaveBar key={i} index={i} isActive={isActive} />)}
      </div>
      <button onClick={() => speak(question)} className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors">
        ↻ REPEAT QUESTION
      </button>
    </div>
  );
}
