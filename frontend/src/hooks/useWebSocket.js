/**
 * useInterviewWebSocket — Typed WebSocket connection for live interview sessions
 */
import { useState, useEffect, useRef, useCallback } from 'react'

const WS_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1')
  .replace('http://', 'ws://')
  .replace('https://', 'wss://')

export function useInterviewWebSocket(sessionId) {
  const [status, setStatus] = useState('disconnected') // connecting | connected | disconnected | error
  const [lastMessage, setLastMessage] = useState(null)
  const [error, setError] = useState(null)
  const wsRef = useRef(null)
  const reconnectRef = useRef(null)
  const pingRef = useRef(null)

  const connect = useCallback(() => {
    if (!sessionId) return
    setStatus('connecting')

    const ws = new WebSocket(`${WS_BASE}/interview/ws/${sessionId}`)

    ws.onopen = () => {
      setStatus('connected')
      setError(null)
      // Heartbeat every 25s
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 25000)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type !== 'pong') {
          setLastMessage(data)
        }
      } catch {}
    }

    ws.onerror = (e) => {
      setError('WebSocket connection error')
      setStatus('error')
    }

    ws.onclose = () => {
      clearInterval(pingRef.current)
      setStatus('disconnected')
    }

    wsRef.current = ws
  }, [sessionId])

  const disconnect = useCallback(() => {
    clearInterval(pingRef.current)
    clearTimeout(reconnectRef.current)
    wsRef.current?.close()
    setStatus('disconnected')
  }, [])

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
      return true
    }
    return false
  }, [])

  const sendAnswer = useCallback((questionId, question, answer, idealAnswer = '', questionType = 'technical', difficulty = 'medium') => {
    return send({
      type: 'answer',
      question_id: questionId,
      question,
      answer,
      ideal_answer: idealAnswer,
      question_type: questionType,
      difficulty,
    })
  }, [send])

  const sendCheatingEvent = useCallback((eventType, severity = 'medium', details = '') => {
    return send({
      type: 'cheating_event',
      event_type: eventType,
      severity,
      details,
      timestamp: new Date().toISOString(),
    })
  }, [send])

  const sendSessionEnd = useCallback((cheatingEvents = []) => {
    return send({ type: 'session_end', cheating_events: cheatingEvents })
  }, [send])

  // Auto-connect when sessionId is set
  useEffect(() => {
    if (sessionId) connect()
    return () => disconnect()
  }, [sessionId])

  return {
    status,
    connected: status === 'connected',
    lastMessage,
    error,
    send,
    sendAnswer,
    sendCheatingEvent,
    sendSessionEnd,
    connect,
    disconnect,
  }
}
