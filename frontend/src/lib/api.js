const BASE = import.meta.env.VITE_API_URL || ''
const PROGRESS_WS_URL = import.meta.env.VITE_PROGRESS_WS_URL || ''

export function resetMockState() {
  return undefined
}

/**
 * Single function for all interactions with the backend.
 * - Profiling phase:  returns { phase: 'PROFILING', reply, options, state, is_complete, session_id }
 * - Conversing phase: returns { phase: 'CONVERSING', reply, narration, education, shortlist,
 *                               reanalyzed, acknowledgement, session_id }
 *
 * Pass sessionId=null on the first call — the backend generates one and returns it.
 * Pass cardContext / fieldContext when the user taps a fund card or a metric label.
 */
export async function sendChat(sessionId, message, { cardContext = null, fieldContext = null } = {}) {
  const res = await fetch(`${BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id:    sessionId || undefined,
      message,
      card_context:  cardContext  || undefined,
      field_context: fieldContext || undefined,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body || res.statusText}`)
  }
  return res.json()
}

export async function getAnalysisProgress(sessionId) {
  if (!sessionId) {
    return { phase: 'PROFILING', progress: [], is_complete: false, session_id: null }
  }

  const res = await fetch(`${BASE}/progress?session_id=${encodeURIComponent(sessionId)}`)

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Progress API ${res.status}: ${body || res.statusText}`)
  }

  return res.json()
}

export function subscribeToAnalysisProgress(sessionId, handlers = {}) {
  if (!sessionId || !PROGRESS_WS_URL || typeof WebSocket === 'undefined') {
    return null
  }

  const {
    onProgress,
    onOpen,
    onClose,
    onError,
  } = handlers

  const socket = new WebSocket(PROGRESS_WS_URL)

  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({
      action: 'subscribeProgress',
      session_id: sessionId,
    }))
    onOpen?.()
  })

  socket.addEventListener('message', (event) => {
    try {
      const payload = JSON.parse(event.data)
      if (payload?.type === 'analysis_progress') {
        onProgress?.(payload)
      }
    } catch (error) {
      onError?.(error)
    }
  })

  socket.addEventListener('close', () => {
    onClose?.()
  })

  socket.addEventListener('error', (event) => {
    onError?.(event)
  })

  return () => {
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close()
    }
  }
}

/**
 * Send base64-encoded PCM audio (16kHz, 16-bit mono) to the backend for transcription.
 * language: 'en' (English) or 'ur' (Urdu) — passed from the investor's detected language.
 * Returns { transcript: string }
 */
export async function transcribeAudio(audioBase64, language = 'en') {
  const res = await fetch(`${BASE}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio: audioBase64, language }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Transcribe API ${res.status}: ${body || res.statusText}`)
  }
  return res.json()
}
