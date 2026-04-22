/**
 * UPDATED AppLayout — Replace your existing src/components/AppLayout.jsx
 * Adds Live Interview + Gamification + Analytics to sidebar
 */
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ── Icons ────────────────────────────────────────────────────────────────────
const Icons = {
  dashboard: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  upload: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
  ats: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M8 11h6M11 8v6"/></svg>,
  analytics: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
  liveInterview: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>,
  interview: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>,
  enhance: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>,
  github: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>,
  shield: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>,
  gamification: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>,
  interviewAnalytics: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
}

// ── Navigation groups ─────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: Icons.dashboard },
    ],
  },
  {
    label: 'Resume Tools',
    items: [
      // { to: '/upload', label: 'Resume Library', icon: Icons.upload },
      { to: '/results', label: 'ATS Matcher', icon: Icons.ats },
      // { to: '/enhance', label: 'AI Enhancer', icon: Icons.enhance },
    ],
  },
  {
    label: 'AI Interview',
    items: [
      { to: '/live-interview-v2', label: 'Live Interview', icon: Icons.liveInterview, badge: 'NEW', badgeColor: '#6366F1' },
      { to: '/interview', label: 'Quick Practice', icon: Icons.interview },
      { to: '/interview-analytics', label: 'Interview Stats', icon: Icons.interviewAnalytics },
    ],
  },
  {
    label: 'Insights',
    items: [
      { to: '/analytics', label: 'Analytics', icon: Icons.analytics },
      { to: '/github', label: 'GitHub Analysis', icon: Icons.github },
      { to: '/fake-detect', label: 'Authenticity', icon: Icons.shield },
    ],
  },
  {
    label: 'Rewards',
    items: [
      { to: '/gamification', label: 'Badges & Points', icon: Icons.gamification, badge: '🏆', badgeColor: '#F59E0B' },
    ],
  },
  {
    label: 'Recruiter',
    items: [
      { to: '/recruiter', label: 'Shortlist Candidates', icon: Icons.ats, badgeColor: '#10B981' },
    ],
  },
]

const PAGE_TITLES = {
  '/dashboard': { title: 'Dashboard', sub: 'Career intelligence overview' },
  '/upload': { title: 'Resume Library', sub: 'Upload and manage your resumes' },
  '/results': { title: 'ATS Matcher', sub: 'Hybrid BERT + TF-IDF scoring' },
  '/analytics': { title: 'Analytics', sub: 'Performance trends & insights' },
  '/interview': { title: 'Quick Practice', sub: 'Fast mock interview sessions' },
  '/live-interview': { title: 'Live AI Interview', sub: 'Full session with camera & AI feedback' },
  '/interview-analytics': { title: 'Interview Analytics', sub: 'Performance breakdown & weak areas' },
  '/enhance': { title: 'AI Resume Enhancer', sub: 'LLM-powered improvements' },
  '/github': { title: 'GitHub Analysis', sub: 'Profile & contribution insights' },
  '/fake-detect': { title: 'Authenticity Check', sub: '7-factor experience verification' },
  '/gamification': { title: 'Rewards Hub', sub: 'Points, badges & leaderboard' },
  '/recruiter': { title: 'Shortlist Candidates', sub: 'JD → Top matching resumes' },
}

function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth()
  const location = useLocation()

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 252 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed left-0 top-0 h-full bg-white border-r border-slate-200 flex flex-col z-40 shadow-sm overflow-hidden"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100 min-h-[60px] shrink-0">
        <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-base"
          style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: '0 2px 8px rgba(79,70,229,0.3)' }}>
          C
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }} className="overflow-hidden">
              <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: 15, color: '#0F172A', lineHeight: 1.2 }}>CareerAI</p>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#6366F1', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Interview Platform
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-3 scrollbar-thin">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <AnimatePresence>
              {!collapsed && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="px-3 mb-1.5 text-2xs font-bold text-slate-400 uppercase tracking-widest font-mono">
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>
            {group.items.map(({ to, label, icon, badge, badgeColor }) => {
              const isActive = location.pathname === to
              return (
                <NavLink key={to} to={to} title={collapsed ? label : undefined}
                  className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative
                    ${collapsed ? 'justify-center' : ''}
                    ${isActive
                      ? 'text-indigo-700 font-semibold'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  style={isActive ? { background: '#EEF2FF', boxShadow: 'inset 0 0 0 1px rgba(99,102,241,0.2)' } : {}}
                >
                  <span className={`shrink-0 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {icon}
                  </span>
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="truncate flex-1 font-body" style={{ fontFamily: "'Inter', sans-serif" }}>
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {!collapsed && badge && (
                    <span className="text-2xs font-mono font-bold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ background: `${badgeColor}15`, color: badgeColor }}>
                      {badge}
                    </span>
                  )}
                  {isActive && !collapsed && (
                    <motion.div layoutId="activeNav"
                      className="absolute right-0 w-0.5 h-5 rounded-full"
                      style={{ background: '#6366F1' }}/>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="border-t border-slate-100 p-3 shrink-0">
        <div className={`flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 cursor-pointer group transition-colors ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
            style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)' }}>
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex-1 min-w-0">
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, color: '#1E293B', lineHeight: 1.2 }} className="truncate">
                  {user?.full_name}
                </p>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#94A3B8', textTransform: 'capitalize' }}>
                  {user?.role}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {!collapsed && (
            <button onClick={logout}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-rose-50 hover:text-rose-500 text-slate-300">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Toggle handle */}
      <button onClick={onToggle}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-all z-10">
        <svg className={`w-3 h-3 transition-transform duration-200 ${collapsed ? 'rotate-0' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
    </motion.aside>
  )
}

function Topbar({ collapsed, onMenuToggle }) {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const meta = PAGE_TITLES[pathname] || { title: 'CareerAI', sub: '' }

  return (
    <header className="h-14 bg-white/90 backdrop-blur-lg border-b border-slate-200 flex items-center justify-between px-5 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        <motion.div key={pathname} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <p style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 14, color: '#0F172A', lineHeight: 1.2 }}>{meta.title}</p>
          {meta.sub && <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#94A3B8', letterSpacing: '0.05em' }}>{meta.sub}</p>}
        </motion.div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Online pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#059669', letterSpacing: '0.08em', fontWeight: 700, textTransform: 'uppercase' }}>Online</span>
        </div>

        {/* User badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)' }}>
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="hidden md:block">
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 600, color: '#1E293B', lineHeight: 1.2 }}>{user?.full_name?.split(' ')[0]}</p>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: '#94A3B8', textTransform: 'capitalize' }}>{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  )
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(p => !p)}/>
      <motion.div
        animate={{ marginLeft: collapsed ? 68 : 252 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex-1 flex flex-col min-w-0"
      >
        <Topbar collapsed={collapsed} onMenuToggle={() => setCollapsed(p => !p)}/>
        <main className="flex-1 p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={window.location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-7xl mx-auto"
            >
              <Outlet/>
            </motion.div>
          </AnimatePresence>
        </main>
      </motion.div>
    </div>
  )
}
