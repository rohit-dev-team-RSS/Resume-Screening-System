import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

// ✅ Create instance
const api = axios.create({
  baseURL: BASE,
  timeout: 60000,
  withCredentials: false // JWT use ho raha hai → cookies ki need nahi
})

// REQUEST INTERCEPTOR (TOKEN ADD)
api.interceptors.request.use((config) => {
  // 1. localStorage (primary)
  let token = localStorage.getItem("access_token");
  
  // 2. Fallback: Cookie (httponly support)
  if (!token) {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'access_token') {
        token = value;
        break;
      }
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('[API] Token attached:', token.length + ' chars');
  } else {
    console.warn('[API] No token found for:', config.url);
  }

  return config;
}, (error) => {
  console.error('[API] Request setup error:', error);
  return Promise.reject(error);
});


// RESPONSE INTERCEPTOR (AUTO REFRESH)

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config

    console.log('[API] 401 detected, attempting refresh...', { url: originalRequest?.url });

    if (
      err.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/')
    ) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem("refresh_token")
        console.log('[API] Refresh token found:', !!refreshToken);

        if (!refreshToken) {
          console.error('[API] No refresh token - forcing logout');
          localStorage.clear();
          window.location.href = "/login";
          return Promise.reject(err);
        }

        const response = await axios.post(
          `${BASE}/auth/refresh`,
          { refresh_token: refreshToken },
          { timeout: 10000 }
        );

        const newAccessToken = response.data.access_token;
        console.log('[API] Refresh SUCCESS - new token length:', newAccessToken?.length);

        localStorage.setItem("access_token", newAccessToken);
        if (response.data.refresh_token) {
          localStorage.setItem("refresh_token", response.data.refresh_token);
        }

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        console.log('[API] Retrying original request');

        return api(originalRequest);

      } catch (refreshError) {
        console.error('[API] Refresh FAILED:', refreshError.response?.data || refreshError.message);
        
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login?reason=auth_expired";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(err)
  }
)


// API FUNCTIONS

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

// Recruiter APIs (NEW)
export const searchCandidates = (payload) => api.post('/recruiter/search', payload)
export const getCandidateDetail = (id) => api.get(`/recruiter/candidate/${id}`)
export const downloadResume = (id) => api.get(`/recruiter/resume/${id}/download`, {
  responseType: 'blob'
})

export const matchJD = async (data) => {
  try {
    console.log("[Recruiter] Sending JD:", data);

    const res = await api.post("/recruiter/v2/match-jd", data);

    console.log("[Recruiter] Response:", res.data);

    return res.data;
  } catch (err) {
    console.error("[Recruiter] ERROR:", err.response?.data || err.message);
    throw err;
  }
};


export default api