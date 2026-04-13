import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/AppLayout'
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

function ProtectedRoute({ children }) {
  const { token, loading, user } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
          <div className="absolute inset-2 rounded-full border-2 border-amber-100 border-b-amber-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
        </div>
        <p className="font-mono text-sm text-ink-400 animate-pulse-soft">Loading CareerAI...</p>
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
              color: '#1C1C28',
              border: '1px solid #EAE7DF',
              borderRadius: '14px',
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: '13px',
              fontWeight: '500',
              boxShadow: '0 8px 32px rgba(15,15,20,0.12)',
              padding: '12px 16px',
            },
            success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
            error: { iconTheme: { primary: '#F43F5E', secondary: '#fff' } },
          }}
        />
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="upload" element={<Upload />} />
            <Route path="results" element={<Results />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="interview" element={<Interview />} />
            <Route path="enhance" element={<Enhance />} />
            <Route path="github" element={<GitHub />} />
            <Route path="fake-detect" element={<FakeDetect />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
