import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'

import AppLayout from './components/AppLayout'

import Login              from './pages/Login'
import Signup             from './pages/Signup'
import Dashboard          from './pages/Dashboard'
import Upload             from './pages/Upload'
import Results            from './pages/Results'
import Analytics          from './pages/Analytics'
import Interview          from './pages/Interview'
import Enhance            from './pages/Enhance'
import GitHub             from './pages/GitHub'
import FakeDetect         from './pages/FakeDetect'
import LiveInterview      from './pages/LiveInterview'
import LiveInterviewV2    from './pages/LiveInterviewV2'
import Gamification       from './pages/Gamification'
import InterviewAnalytics from './pages/InterviewAnalytics'

// ── Loading spinner ─────────────────────────────────────────────────────────
function Loader() {
  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:20 }}>
      <div style={{ position:'relative', width:56, height:56 }}>
        <div style={{ position:'absolute', inset:0, borderRadius:'50%',
          border:'4px solid #EEF2FF', borderTopColor:'#6366F1', animation:'spin 0.8s linear infinite' }}/>
        <div style={{ position:'absolute', inset:8, borderRadius:'50%',
          border:'3px solid #EDE9FE', borderBottomColor:'#8B5CF6',
          animation:'spin 1.3s linear infinite reverse' }}/>
        <div style={{ position:'absolute', inset:15, borderRadius:'50%',
          border:'2px solid #E0E7FF', borderTopColor:'#6366F1',
          animation:'spin 1.8s linear infinite' }}/>
      </div>
      <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'#94A3B8',
        letterSpacing:'0.12em', textTransform:'uppercase' }}>
        Loading CareerAI...
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── Route guards ────────────────────────────────────────────────────────────
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loader />
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/dashboard" replace /> : children
}

// ── App ─────────────────────────────────────────────────────────────────────
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
            error:   { iconTheme: { primary: '#F43F5E', secondary: '#fff' } },
          }}
        />

        <Routes>
          {/* ── Public ── */}
          <Route path="/login"  element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />

          {/* ── Protected (inside AppLayout shell) ── */}
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />

            {/* Core */}
            <Route path="dashboard"            element={<Dashboard />} />
            <Route path="upload"               element={<Upload />} />
            <Route path="results"              element={<Results />} />
            <Route path="analytics"            element={<Analytics />} />
            <Route path="enhance"              element={<Enhance />} />
            <Route path="github"               element={<GitHub />} />
            <Route path="fake-detect"          element={<FakeDetect />} />

            {/* Interview */}
            <Route path="interview"            element={<Interview />} />
            <Route path="live-interview"       element={<LiveInterview />} />
            <Route path="live-interview-v2"    element={<LiveInterviewV2 />} />
            <Route path="interview-analytics"  element={<InterviewAnalytics />} />

            {/* Gamification */}
            <Route path="gamification"         element={<Gamification />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}