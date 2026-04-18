import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {

  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // 🔐 LOGOUT
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch (err) {
      console.error("Logout error:", err)
    } finally {
        localStorage.removeItem("access_token")
        localStorage.removeItem("refresh_token") // ✅ remove token
      delete api.defaults.headers.common["Authorization"] // ✅ remove header
      setUser(null)
    }
  }, [])

  // 🔍 CHECK USER (on load) ✅ FIXED
  useEffect(() => {
    let isMounted = true

    const token = localStorage.getItem("access_token")

    // ❗ ONLY call API if token exists
    if (!token) {
      setLoading(false)
      return
    }

    // ✅ attach token
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`

    api.get('/auth/me')
      .then(res => {
        if (isMounted) setUser(res.data)
      })
      .catch(() => {
        if (isMounted) {
          setUser(null)
            localStorage.removeItem("access_token")
            localStorage.removeItem("refresh_token")
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // 🔐 LOGIN ✅ FIXED
  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })

    // ✅ correct tokens
    localStorage.setItem("access_token", data.access_token)
    localStorage.setItem("refresh_token", data.refresh_token)

    api.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`

    setUser(data.user)
    return data
  }

  // 📝 SIGNUP ✅ FIXED
  const signup = async (payload) => {
    const { data } = await api.post('/auth/signup', payload)

    localStorage.setItem("access_token", data.access_token)
    localStorage.setItem("refresh_token", data.refresh_token)

    api.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`

    setUser(data.user)
    return data
  }

  // 🔵 GOOGLE LOGIN ✅ FIXED
// AuthContext.jsx ke andar 🔵 GOOGLE LOGIN section

const googleLogin = useCallback(async (token, role = 'candidate') => {
  try {
    const { data } = await api.post('/auth/google', { token, role });

    localStorage.setItem("access_token", data.access_token)
    localStorage.setItem("refresh_token", data.refresh_token)

    // 2. Set API Header
    // api.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
    api.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`

    // 3. Update State
    setUser(data.user);
    
    return data;
  } catch (error) {
    console.error("Google Login Error:", error);
    throw error; // Isse UI mein error dikha payenge
  }
}, []);


  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, googleLogin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}