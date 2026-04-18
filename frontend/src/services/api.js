import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

// ✅ Create instance
const api = axios.create({
  baseURL: BASE,
  timeout: 60000,
  withCredentials: false // ❌ JWT use ho raha hai → cookies ki need nahi
})


// ================================
// ✅ REQUEST INTERCEPTOR (TOKEN ADD)
// ================================
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token")

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})


// ================================
// ✅ RESPONSE INTERCEPTOR (AUTO REFRESH)
// ================================
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config

    if (
      err.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/')
    ) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem("refresh_token")

        // ❌ Agar refresh token hi nahi hai → logout
        if (!refreshToken) {
          localStorage.clear()
          window.location.href = "/login"
          return Promise.reject(err)
        }

        // ✅ Refresh call (correct format)
        const response = await axios.post(
          `${BASE}/auth/refresh`,
          {
            refresh_token: refreshToken
          }
        )

        const newAccessToken = response.data.access_token

        // ✅ Save new token
        localStorage.setItem("access_token", newAccessToken)

        // ✅ Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`

        return api(originalRequest)

      } catch (refreshError) {
        // ❌ Refresh fail → logout
        localStorage.clear()
        window.location.href = "/login"
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(err)
  }
)


// ================================
// ✅ API FUNCTIONS
// ================================

export const uploadResume = (file, onProgress) => {
  const f = new FormData()
  f.append('file', file)

  return api.post('/resume/upload', f, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e =>
      onProgress?.(Math.round((e.loaded * 100) / e.total))
  })
}

export const getResumes = (p) => api.get('/resume/', { params: p })

export const deleteResume = (id) => api.delete(`/resume/${id}`)

export const reparseResume = (id) => api.post(`/resume/${id}/reparse`)

export const matchATS = (p) => api.post('/ats/match', p)

export const getATSHistory = (p) => api.get('/ats/history', { params: p })

export const getATSResult = (id) => api.get(`/ats/result/${id}`)

export const analyzeSkills = (p) => api.post('/skills/analyze', p)

export const getMarketDemand = () => api.get('/skills/market-demand')

export const enhanceResume = (p) => api.post('/enhance/resume', p)

export const generateInterview = (p) => api.post('/interview/generate', p)

export const analyzeGitHub = (p) => api.post('/github/analyze', p)

export const detectFake = (p) => api.post('/fake-detect/analyze', p)

export const generatePDF = (p) => api.post('/pdf/generate', p)

export const getMyAnalytics = (p) =>
  api.get('/analytics/me', { params: p })

export const getSkillsMarket = () =>
  api.get('/analytics/skills-market')


// ================================
export default api