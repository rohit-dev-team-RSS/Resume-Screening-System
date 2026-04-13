import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const ml = collapsed ? 72 : 256

  return (
    <div className="flex min-h-screen bg-cream-100">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(p => !p)} />
      <motion.div
        animate={{ marginLeft: ml }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="flex-1 flex flex-col min-w-0"
      >
        <Navbar sidebarCollapsed={collapsed} onMenuToggle={() => setCollapsed(p => !p)} />
        <main className="flex-1 p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={window.location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-7xl mx-auto"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </motion.div>
    </div>
  )
}
