import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  )},
  // { to: '/upload', label: 'Resume Library', icon: (
  //   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
  //     <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
  //   </svg>
  // )},
  { to: '/results', label: 'ATS Matcher', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/>
      <path strokeLinecap="round" d="M8 11h6M11 8v6"/>
    </svg>
  )},
  // { to: '/analytics', label: 'Analytics', icon: (
  //   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
  //     <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
  //   </svg>
  // )},
  { to: '/interview', label: 'Mock Interview', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
    </svg>
  )},
  { to: '/enhance', label: 'AI Enhancer', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
    </svg>
  )},
  { to: '/github', label: 'GitHub Analysis', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/>
    </svg>
  )},
  { to: '/fake-detect', label: 'Authenticity', icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
    </svg>
  )},
]

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout } = useAuth()
  const location = useLocation()

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed left-0 top-0 h-full flex flex-col bg-white border-r border-cream-200 z-40 shadow-sm"
      style={{ overflow: 'hidden' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-cream-200 min-h-[68px] shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-indigo flex items-center justify-center text-white font-display font-700 text-lg shrink-0 shadow-indigo">
          C
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <p className="font-display font-700 text-ink-900 text-base leading-tight">CareerAI</p>
              <p className="font-mono text-2xs text-indigo-500 tracking-wider uppercase">Co-Pilot v2</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto scrollbar-thin">
        {!collapsed && (
          <p className="label-sm px-3 mb-3">Navigation</p>
        )}
        {NAV_ITEMS.map(({ to, label, icon }) => {
          const isActive = location.pathname === to
          return (
            <NavLink
              key={to}
              to={to}
              title={collapsed ? label : undefined}
              className={`nav-link ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
            >
              <span className={`nav-icon shrink-0 ${isActive ? 'text-indigo-600' : 'text-ink-400'}`}>
                {icon}
              </span>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="truncate"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>
              {isActive && !collapsed && (
                <motion.div
                  layoutId="activeIndicator"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500"
                />
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-white border border-cream-300 shadow-sm
                   flex items-center justify-center text-ink-400 hover:text-indigo-600 hover:border-indigo-200
                   transition-all duration-200 z-10"
      >
        <svg className={`w-3 h-3 transition-transform duration-300 ${collapsed ? 'rotate-0' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>

      {/* User section */}
      <div className="border-t border-cream-200 p-3 shrink-0">
        <div className={`flex items-center gap-3 p-2 rounded-xl hover:bg-cream-100 transition-colors cursor-pointer group ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-700 text-sm shrink-0 shadow-sm">
            {user?.full_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="font-600 text-xs text-ink-800 truncate">{user?.full_name}</p>
                <p className="text-2xs text-ink-400 font-mono capitalize">{user?.role}</p>
              </motion.div>
            )}
          </AnimatePresence>
          {!collapsed && (
            <button
              onClick={logout}
              className="shrink-0 p-1.5 rounded-lg text-ink-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100"
              title="Logout"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </motion.aside>
  )
}
