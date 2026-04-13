import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import ResumeUpload from '../components/ResumeUpload'
import { getResumes, deleteResume, reparseResume } from '../services/api'

const STATUS = {
  parsed: { badge: 'badge-emerald', label: '✓ Parsed', dot: 'bg-emerald-400' },
  processing: { badge: 'badge-indigo', label: '⟳ Processing', dot: 'bg-indigo-400' },
  pending: { badge: 'badge-amber', label: '◷ Pending', dot: 'bg-amber-400' },
  failed: { badge: 'badge-rose', label: '✕ Failed', dot: 'bg-rose-400' },
}

function ResumeCard({ resume, onDelete, onReparse, index }) {
  const [deleting, setDeleting] = useState(false)
  const st = STATUS[resume.status] || STATUS.pending
  const sizeKB = Math.round(resume.file_size_bytes / 1024)
  const parsed = resume.parsed_data

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.07 }}
      className="card p-5 group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-start gap-4">
        {/* File type icon */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-mono text-xs font-700 shrink-0 border-2
          ${resume.file_type === 'pdf' ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-sky-50 border-sky-200 text-sky-600'}`}>
          {resume.file_type?.toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-600 text-sm text-ink-800 font-body leading-tight truncate max-w-xs">{resume.original_filename}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${st.dot} animate-pulse-soft`}/>
                  <span className={`badge ${st.badge} text-2xs py-0.5`}>{st.label}</span>
                </div>
                <span className="text-2xs font-mono text-ink-400">{sizeKB} KB</span>
                {parsed?.word_count > 0 && <span className="text-2xs font-mono text-ink-400">{parsed.word_count} words</span>}
                {parsed?.total_experience_years > 0 && (
                  <span className="badge-gray text-2xs">{parsed.total_experience_years}y exp</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {resume.status === 'failed' && (
                <button onClick={() => { onReparse(resume.id) }} className="btn-ghost text-xs text-amber-600 hover:bg-amber-50 px-2 py-1.5">
                  ↺ Retry
                </button>
              )}
              <button onClick={async () => {
                if (!confirm('Delete this resume?')) return
                setDeleting(true)
                try { await deleteResume(resume.id); onDelete(resume.id) }
                catch { toast.error('Delete failed') }
                finally { setDeleting(false) }
              }} disabled={deleting}
                className="btn-ghost text-xs text-rose-500 hover:bg-rose-50 px-2 py-1.5">
                {deleting ? '...' : '✕'}
              </button>
            </div>
          </div>

          {/* Skills preview */}
          {parsed?.skills?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {parsed.skills.slice(0, 8).map(sk => (
                <span key={sk} className="badge-gray text-2xs py-0.5 px-2">{sk}</span>
              ))}
              {parsed.skills.length > 8 && (
                <span className="badge-indigo text-2xs py-0.5 px-2">+{parsed.skills.length - 8} more</span>
              )}
            </div>
          )}

          {/* Error */}
          {resume.parse_error && (
            <div className="mt-3 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-xs font-mono text-rose-600">
              ⚠ {resume.parse_error}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function Upload() {
  const [resumes, setResumes] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchResumes = async () => {
    try {
      const { data } = await getResumes({ page_size: 20 })
      setResumes(data.resumes || [])
      setTotal(data.total || 0)
    } catch { toast.error('Failed to load resumes') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchResumes() }, [])

  useEffect(() => {
    const busy = resumes.some(r => ['pending', 'processing'].includes(r.status))
    if (!busy) return
    const id = setInterval(fetchResumes, 3000)
    return () => clearInterval(id)
  }, [resumes])

  const handleDelete = id => setResumes(prev => prev.filter(r => r.id !== id))
  const handleReparse = async id => {
    try { await reparseResume(id); toast.success('Reparsing...'); setTimeout(fetchResumes, 1000) }
    catch { toast.error('Reparse failed') }
  }

  return (
    <div className="space-y-6 pb-6 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="page-title mb-1">Resume Library</h2>
        <p className="text-sm text-ink-400 font-body">Upload PDF or DOCX files — AI extracts skills, experience & contact info automatically</p>
      </motion.div>

      {/* Upload Card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
          </div>
          <h3 className="font-display font-600 text-ink-800">Upload New Resume</h3>
        </div>
        <ResumeUpload onSuccess={() => { setLoading(true); fetchResumes() }} />
      </motion.div>

      {/* Resume List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-600 text-ink-800">
            Your Resumes
            {total > 0 && <span className="ml-2 badge-indigo text-xs font-mono align-middle">{total}</span>}
          </h3>
          {resumes.some(r => ['pending', 'processing'].includes(r.status)) && (
            <div className="flex items-center gap-2 text-xs font-mono text-indigo-600">
              <div className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"/>
              Parsing in progress...
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24"/>)}
          </div>
        ) : resumes.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="card p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-cream-200 flex items-center justify-center text-3xl mx-auto mb-4">📂</div>
            <p className="font-display font-600 text-ink-600 mb-1">No resumes yet</p>
            <p className="text-sm text-ink-400 font-body">Upload your first resume above to get started</p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {resumes.map((r, i) => (
              <ResumeCard key={r.id} resume={r} index={i}
                onDelete={handleDelete} onReparse={handleReparse}/>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
