import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

const PAGE_META = {
  '/dashboard': { title: 'Dashboard', sub: 'Your career intelligence overview' },
  '/upload': { title: 'Resume Library', sub: 'Upload and manage your resumes' },
  '/results': { title: 'ATS Matcher', sub: 'AI-powered resume scoring engine' },
  '/analytics': { title: 'Analytics', sub: 'Performance trends & insights' },
  '/interview': { title: 'Mock Interview', sub: 'AI-generated interview preparation' },
  '/enhance': { title: 'AI Enhancer', sub: 'LLM-powered resume improvements' },
  '/github': { title: 'GitHub Analysis', sub: 'Profile & contribution insights' },
  '/fake-detect': { title: 'Authenticity Check', sub: 'Experience verification system' },
}

export default function Navbar({ sidebarCollapsed, onMenuToggle }) {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const meta = PAGE_META[pathname] || { title: 'CareerAI', sub: '' }

  return (
    <header className="h-16 glass sticky top-0 z-30 border-b border-cream-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="w-8 h-8 rounded-lg flex flex-col items-center justify-center gap-1.5
                     text-ink-400 hover:text-ink-700 hover:bg-cream-200 transition-all"
        >
          <div className="w-4 h-0.5 bg-current rounded-full" />
          <div className="w-3 h-0.5 bg-current rounded-full" />
          <div className="w-4 h-0.5 bg-current rounded-full" />
        </button>

        <motion.div key={pathname} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <h1 className="font-display font-600 text-ink-900 text-base leading-tight">{meta.title}</h1>
          {meta.sub && <p className="text-2xs font-mono text-ink-400 tracking-wide">{meta.sub}</p>}
        </motion.div>
      </div>

      <div className="flex items-center gap-3">
        {/* Live status */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
          <span className="text-2xs font-mono font-600 text-emerald-700 tracking-wide uppercase">System Online</span>
        </div>

        {/* ATS checks count */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-full">
          <span className="text-2xs font-mono text-indigo-600">{user?.total_ats_checks || 0} checks</span>
        </div>

        {/* User */}
        <div className="flex items-center gap-2 pl-3 pr-2 py-1.5 bg-white border border-cream-300 rounded-xl shadow-xs">
          <div className="w-7 h-7 rounded-lg bg-gradient-indigo flex items-center justify-center text-white font-700 text-xs">
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-600 text-ink-800 leading-tight">{user?.full_name}</p>
            <p className="text-2xs font-mono text-ink-400 capitalize leading-tight">{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
