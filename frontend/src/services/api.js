import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

const api = axios.create({ baseURL: BASE, timeout: 60000 })

api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('access_token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

api.interceptors.response.use(r => r, async err => {
  if (err.response?.status === 401 && !err.config._retry) {
    err.config._retry = true
    const rf = localStorage.getItem('refresh_token')
    if (rf) {
      try {
        const { data } = await axios.post(`${BASE}/auth/refresh`, { refresh_token: rf })
        localStorage.setItem('access_token', data.access_token)
        err.config.headers.Authorization = `Bearer ${data.access_token}`
        return api(err.config)
      } catch { localStorage.clear(); window.location.href = '/login' }
    }
  }
  return Promise.reject(err)
})

export const uploadResume = (file, onProgress) => {
  const f = new FormData()
  f.append('file', file)
  return api.post('/resume/upload', f, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: e => onProgress?.(Math.round(e.loaded * 100 / e.total))
  })
}
export const getResumes = p => api.get('/resume/', { params: p })
export const deleteResume = id => api.delete(`/resume/${id}`)
export const reparseResume = id => api.post(`/resume/${id}/reparse`)
export const matchATS = p => api.post('/ats/match', p)
export const getATSHistory = p => api.get('/ats/history', { params: p })
export const getATSResult = id => api.get(`/ats/result/${id}`)
export const analyzeSkills = p => api.post('/skills/analyze', p)
export const getMarketDemand = () => api.get('/skills/market-demand')
export const enhanceResume = p => api.post('/enhance/resume', p)
export const generateInterview = p => api.post('/interview/generate', p)
export const analyzeGitHub = p => api.post('/github/analyze', p)
export const detectFake = p => api.post('/fake-detect/analyze', p)
export const generatePDF = p => api.post('/pdf/generate', p)
export const getMyAnalytics = p => api.get('/analytics/me', { params: p })
export const getSkillsMarket = () => api.get('/analytics/skills-market')

export default api
