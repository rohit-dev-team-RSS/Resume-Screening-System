/**
 * Interview API Service — AI interview, feedback, cheating, gamification
 * Extends existing api.js without modifying it
 */
import api from './api'
// ── AI Interview Generation ──────────────────────────────────────────────────
// ── AI Interview Generation ─────────────────────────────────
export const generateAIInterview = (payload) =>
  api.post('/interview/ai/generate', payload)


// ── Answer Evaluation ───────────────────────────────────────
export const evaluateAnswer = (payload) =>
  api.post('/interview/ai/feedback', payload)


// ── Session Completion ──────────────────────────────────────
export const completeInterviewSession = (payload) =>
  api.post('/interview/ai/complete', payload)


// ── Cheating Report ─────────────────────────────────────────
export const submitCheatingReport = (payload) =>
  api.post('/interview/ai/cheating/report', payload)


// ── Gamification ────────────────────────────────────────────
export const getGamificationProfile = () =>
  api.get('/interview/ai/gamification/profile')

export const getLeaderboard = (limit = 20) =>
  api.get(`/interview/ai/gamification/leaderboard?limit=${limit}`)

export const getBadgeCatalog = () =>
  api.get('/interview/ai/badges/catalog')

// ── WebSocket helper ──────────────────────────────────────────────────────────
export const createInterviewWebSocket = (sessionId) => {
  const wsBase = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1')
    .replace('http://', 'ws://')
    .replace('https://', 'wss://')
  return new WebSocket(`${wsBase}/interview/ws/${sessionId}`)
}

// ── Resume Fetch ─────────────────────────────────────────────
export const getResumes = () =>
  api.get('/resume')