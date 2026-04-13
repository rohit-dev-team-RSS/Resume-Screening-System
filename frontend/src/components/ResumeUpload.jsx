import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { uploadResume } from '../services/api'

export default function ResumeUpload({ onSuccess }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState('')

  const onDrop = useCallback(async (accepted, rejected) => {
    if (rejected.length) { toast.error('Only PDF or DOCX files (max 10MB)'); return }
    const file = accepted[0]
    if (!file) return

    setUploading(true); setProgress(0); setPhase('Uploading file...')
    try {
      await uploadResume(file, pct => {
        setProgress(pct)
        if (pct === 100) setPhase('AI parsing your resume...')
      })
      setPhase('Complete!')
      await new Promise(r => setTimeout(r, 600))
      toast.success('Resume uploaded & parsing started!')
      onSuccess?.()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false); setProgress(0); setPhase('')
    }
  }, [onSuccess])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop, multiple: false, disabled: uploading,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 10 * 1024 * 1024,
  })

  return (
    <div>
      <div
        {...getRootProps()}
        className={`
          relative rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer
          transition-all duration-300 overflow-hidden
          ${isDragReject ? 'border-rose-400 bg-rose-50' : isDragActive ? 'border-indigo-400 bg-indigo-50 shadow-indigo' : 'border-cream-300 bg-cream-100 hover:border-indigo-300 hover:bg-indigo-50/30'}
          ${uploading ? 'pointer-events-none' : ''}
        `}
      >
        {/* Animated dots pattern */}
        <div className="absolute inset-0 bg-dots opacity-40" style={{ backgroundSize: '20px 20px' }} />

        {/* Drag active glow */}
        <AnimatePresence>
          {isDragActive && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-br from-indigo-100/60 to-indigo-50/40"
            />
          )}
        </AnimatePresence>

        <div className="relative">
          {uploading ? (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-5">
              {/* Circular Progress */}
              <div className="w-20 h-20 mx-auto relative">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#E0E7FF" strokeWidth="6"/>
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#6366F1" strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={213.6}
                    strokeDashoffset={213.6 - (progress / 100) * 213.6}
                    style={{ transition: 'stroke-dashoffset 0.3s ease', filter: 'drop-shadow(0 0 6px rgba(99,102,241,0.4))' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-display font-700 text-indigo-600 text-lg">{progress}%</span>
                </div>
              </div>
              <div>
                <p className="font-600 font-body text-ink-800 text-sm">{phase}</p>
                <p className="text-xs font-mono text-ink-400 mt-1 animate-pulse-soft">Please wait...</p>
              </div>
              <div className="w-48 mx-auto h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}/>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-4">
              <motion.div
                animate={isDragActive ? { scale: 1.15, y: -4 } : { scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400 }}
                className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-2xl transition-all duration-200
                  ${isDragActive ? 'bg-indigo-100 shadow-indigo' : 'bg-white shadow-md border border-cream-300'}`}
              >
                {isDragReject ? '✕' : isDragActive ? '⬇' : (
                  <svg className={`w-7 h-7 ${isDragActive ? 'text-indigo-600' : 'text-ink-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                  </svg>
                )}
              </motion.div>

              <div>
                <p className="font-display font-600 text-ink-800 text-lg">
                  {isDragReject ? 'Invalid file type' : isDragActive ? 'Release to upload' : 'Upload your resume'}
                </p>
                <p className="text-sm text-ink-400 font-body mt-1">
                  {isDragReject ? 'Only PDF and DOCX accepted' : 'Drag & drop or click to browse · PDF, DOCX · max 10MB'}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="badge-indigo text-2xs">PDF</span>
                <span className="badge-gray text-2xs">DOCX</span>
                <span className="badge-gray text-2xs">Max 10MB</span>
              </div>
            </div>
          )}
        </div>
        <input {...getInputProps()} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { icon: '✓', text: 'Text-based PDFs best', ok: true },
          { icon: '✓', text: 'Standard DOCX format', ok: true },
          { icon: '⚠', text: 'Scanned PDFs may fail', ok: false },
        ].map((t, i) => (
          <div key={i} className="flex items-center gap-2 p-2.5 bg-white rounded-xl border border-cream-200 shadow-xs">
            <span className={`text-sm flex-shrink-0 ${t.ok ? 'text-emerald-500' : 'text-amber-500'}`}>{t.icon}</span>
            <span className="text-2xs font-body text-ink-500 leading-tight">{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
