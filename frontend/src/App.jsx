/**
 * COMPLETE App.jsx — Replace your existing src/App.jsx with this file
 * Includes all existing + new routes (live-interview, gamification, interview-analytics)
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'

// Layout — use the updated AppLayout from AppLayout_updated.jsx
import AppLayout from './components/AppLayout'

// Existing pages (keep as-is)
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import Results from './pages/Results'
import Analytics from './pages/Analytics'
import Interview from './pages/Interview'
import Enhance from './pages/Enhance'
import GitHub from './pages/GitHub'
import FakeDetect from './pages/FakeDetect'

// New pages (add these)
import LiveInterview from './pages/LiveInterview'
import Gamification from './pages/Gamification'
import InterviewAnalytics from './pages/InterviewAnalytics'

function ProtectedRoute({ children }) {
  const { loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        {/* Triple ring loader */}
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"/>
          <div className="absolute inset-2 rounded-full border-4 border-violet-100 border-b-violet-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.4s' }}/>
          <div className="absolute inset-4 rounded-full border-2 border-indigo-200 border-t-indigo-400 animate-spin" style={{ animationDuration: '2s' }}/>
        </div>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#94A3B8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Loading CareerAI...
        </p>
      </div>
    </div>
  )
  const hasToken = !!localStorage.getItem('access_token')
  return hasToken ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { loading } = useAuth()
  if (loading) return null
  const hasToken = !!localStorage.getItem('access_token')
  return hasToken ? <Navigate to="/dashboard" replace /> : children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          gutter={10}
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff',
              color: '#1E293B',
              border: '1px solid #E2E8F0',
              borderRadius: '14px',
              fontFamily: "'Inter', sans-serif",
              fontSize: '13px',
              fontWeight: '500',
              boxShadow: '0 8px 32px rgba(15,15,20,0.10)',
              padding: '12px 16px',
            },
            success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
            error: { iconTheme: { primary: '#F43F5E', secondary: '#fff' } },
          }}
        />
        <Routes>
          {/* Public */}
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

          {/* Protected — all inside AppLayout */}
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* ── Existing routes (untouched) ── */}
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="upload" element={<Upload />} />
            <Route path="results" element={<Results />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="interview" element={<Interview />} />
            <Route path="enhance" element={<Enhance />} />
            <Route path="github" element={<GitHub />} />
            <Route path="fake-detect" element={<FakeDetect />} />

            {/* ── NEW routes ── */}
            <Route path="live-interview" element={<LiveInterview />} />
            <Route path="gamification" element={<Gamification />} />
            <Route path="interview-analytics" element={<InterviewAnalytics />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
