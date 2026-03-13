import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { SendHorizonal, ChevronDown, ChevronUp, Mic, MicOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { sendChat, transcribeAudio } from '@/lib/api'
import { Markdown } from '@/components/Markdown'
import { TARGET_SAMPLE_RATE, mergeFloat32Chunks, downsampleAudioBuffer, floatTo16BitPCM, pcm16ToBase64 } from '@/lib/audioRecording'
import { humanizeField } from '@/lib/utils'

function normalizeAutoMessage(message) {
  if (typeof message !== 'string') return message

  const separatorIndex = message.lastIndexOf('|')
  if (separatorIndex === -1) return message

  const suffix = message.slice(separatorIndex + 1)
  if (!/^\d+$/.test(suffix)) return message

  return message.slice(0, separatorIndex)
}

function formatEducationAnswer(education) {
  if (!education) return ''

  const fieldLabel = humanizeField(education.field)
  return [
    `**${fieldLabel}**`,
    `**What it means**\n${education.definition}`,
    `**For this fund**\n${education.in_context}`,
    `**Why it matters for your goal**\n${education.why_it_matters}`,
  ].join('\n\n')
}

function buildAnswer(response) {
  const parts = []
  const reply = response?.reply?.trim()
  const education = formatEducationAnswer(response?.education)

  if (reply) parts.push(reply)
  if (education) parts.push(education)

  return parts.join('\n\n').trim()
}

function FollowUpBubble({ qa }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-terracotta text-white rounded-2xl rounded-tr-sm px-4 py-2.5">
          <p className="text-sm leading-relaxed">{qa.question}</p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-full bg-terracotta-light flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-terracotta text-xs font-semibold">G</span>
        </div>
        <div className="max-w-[85%] bg-white border border-sand rounded-2xl rounded-tl-sm px-3 py-2.5">
          {qa.answer
            ? <Markdown className="text-sm text-brown leading-relaxed">{qa.answer}</Markdown>
            : (
              <span className="flex gap-1 items-center py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-terracotta/40 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-terracotta/40 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-terracotta/40 animate-bounce [animation-delay:300ms]" />
              </span>
            )
          }
        </div>
      </div>
    </div>
  )
}

export const FollowUpChat = forwardRef(function FollowUpChat(
  { sessionId, autoMessage, cardContext, fieldContext, onResponse, onFirstFollowUp, onReanalysisStart, onReanalysisError },
  ref
) {
  const [followUps, setFollowUps]           = useState([])
  const [text, setText]                     = useState('')
  const [isLoading, setIsLoading]           = useState(false)
  const [isExpanded, setIsExpanded]         = useState(false)
  const [isListening, setIsListening]       = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const containerRef      = useRef(null)
  const textareaRef       = useRef(null)
  const listEndRef        = useRef(null)
  const prevAutoMsg       = useRef(null)
  const mediaStreamRef    = useRef(null)
  const audioContextRef   = useRef(null)
  const processorRef      = useRef(null)
  const pcmSamplesRef     = useRef([])
  const reanalysisPendingRef = useRef(null)

  useImperativeHandle(ref, () => ({
    scrollIntoView: () => {
      containerRef.current?.scrollIntoView({ behavior: 'smooth' })
      setIsExpanded(true)
      setTimeout(() => textareaRef.current?.focus(), 100)
    },
  }))

  // Click-outside to collapse (only when there are messages to hide)
  useEffect(() => {
    if (!isExpanded || followUps.length === 0) return
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsExpanded(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isExpanded, followUps.length])

  // Auto-send when autoMessage changes
  useEffect(() => {
    if (!autoMessage || autoMessage === prevAutoMsg.current) return
    prevAutoMsg.current = autoMessage
    setIsExpanded(true)
    submit(normalizeAutoMessage(autoMessage), { cardContext, fieldContext })
  }, [autoMessage]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (message, context = { cardContext, fieldContext }) => {
    const trimmed = message?.trim()
    if (!trimmed || isLoading) return

    const normalized = trimmed.toLowerCase().trim().replace(/[!.?]+$/g, '')
    const affirmatives = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'do it', 'go ahead', 'please', 'sounds good', 'haan', 'ji', 'theek hai', 'haan ji']
    const isReanalysisConfirmation = Boolean(reanalysisPendingRef.current) && affirmatives.some(option => normalized.includes(option))

    const id = Date.now()
    setText('')
    setIsExpanded(!isReanalysisConfirmation)

    if (followUps.length === 0) onFirstFollowUp?.()

    setFollowUps(prev => [...prev, { id, question: trimmed, answer: '' }])
    setIsLoading(true)

    if (isReanalysisConfirmation) {
      onReanalysisStart?.(reanalysisPendingRef.current)
    }

    setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    try {
      const response = await sendChat(sessionId, trimmed, {
        cardContext: context?.cardContext || null,
        fieldContext: context?.fieldContext || null,
      })
      reanalysisPendingRef.current = response.reanalysis_pending ?? null
      setFollowUps(prev => prev.map(fu => fu.id === id ? { ...fu, answer: buildAnswer(response) } : fu))
      onResponse?.(response)
    } catch {
      reanalysisPendingRef.current = null
      if (isReanalysisConfirmation) {
        onReanalysisError?.()
      }
      setFollowUps(prev => prev.map(fu =>
        fu.id === id ? { ...fu, answer: 'Sorry, something went wrong. Please try again.' } : fu
      ))
    } finally {
      setIsLoading(false)
      setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  const stopRecording = useCallback(async () => {
    const inputSampleRate = audioContextRef.current?.sampleRate ?? TARGET_SAMPLE_RATE

    processorRef.current?.disconnect()
    await audioContextRef.current?.close()
    mediaStreamRef.current?.getTracks().forEach(t => t.stop())
    setIsListening(false)

    const samples = pcmSamplesRef.current
    if (!samples.length) return

    const merged = mergeFloat32Chunks(samples)
    const downsampled = downsampleAudioBuffer(merged, inputSampleRate, TARGET_SAMPLE_RATE)
    const pcm16 = floatTo16BitPCM(downsampled)
    const audioBase64 = pcm16ToBase64(pcm16)

    pcmSamplesRef.current = []
    processorRef.current = null
    audioContextRef.current = null
    mediaStreamRef.current = null

    setIsTranscribing(true)
    try {
      const { transcript } = await transcribeAudio(audioBase64)
      if (transcript?.trim()) {
        setText(prev => prev ? prev + ' ' + transcript : transcript)
        textareaRef.current?.focus()
      } else {
        toast.error('No speech detected', {
          description: 'Try again and speak a bit closer to the microphone.',
        })
      }
    } catch (e) {
      console.error('Transcription error:', e)
      toast.error('Voice transcription failed', {
        description: 'Please try again in a quieter environment or type your question.',
      })
    } finally {
      setIsTranscribing(false)
    }
  }, [])

  const startVoice = useCallback(async () => {
    if (isListening) { stopRecording(); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      pcmSamplesRef.current  = []

      const ctx       = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = ctx
      const source    = ctx.createMediaStreamSource(stream)
      const processor = ctx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0)
        pcmSamplesRef.current.push(new Float32Array(float32))
      }

      source.connect(processor)
      processor.connect(ctx.destination)
      setIsListening(true)
      setIsExpanded(true)
    } catch (e) {
      console.error('Microphone error:', e)
      toast.error('Microphone access failed', {
        description: 'Please check your browser microphone permissions and try again.',
      })
    }
  }, [isListening, stopRecording])

  const hasConversation = followUps.length > 0

  return (
    <div ref={containerRef} className="border-t border-sand bg-cream">
      {/* Conversation list — shown only when expanded */}
      {hasConversation && isExpanded && (
        <div className="px-4 pt-4 pb-2 space-y-4 max-h-72 overflow-y-auto">
          {followUps.map(fu => <FollowUpBubble key={fu.id} qa={fu} />)}
          <div ref={listEndRef} />
        </div>
      )}

      {/* Header row — collapse toggle shown when there's conversation to hide */}
      {hasConversation && (
        <div className="flex items-center justify-between px-4 pt-2">
          <span className="text-xs text-muted/60">
            {isExpanded ? 'Ask Gullak' : `${followUps.length} message${followUps.length > 1 ? 's' : ''}`}
          </span>
          <button
            onClick={() => setIsExpanded(v => !v)}
            className="flex items-center gap-1 text-xs text-muted hover:text-brown transition-colors"
          >
            {isExpanded
              ? <><ChevronDown size={13} />Minimise</>
              : <><ChevronUp size={13} />Show</>
            }
          </button>
        </div>
      )}

      {/* Card context indicator */}
      {(cardContext || fieldContext) && isExpanded && (
        <p className="px-4 pt-1 text-xs text-terracotta/80 font-medium">
          {fieldContext
            ? `Explaining: ${fieldContext.label} for ${fieldContext.fund_name}`
            : `Asking about: ${cardContext.fund_name}`}
        </p>
      )}

      {/* Input bar */}
      <div className="px-4 py-3">
        <div className="flex items-end gap-2 bg-white border border-sand rounded-2xl px-4 py-2.5 focus-within:border-terracotta/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(text) }
            }}
            placeholder={
              isListening    ? 'Recording… tap mic to send' :
              isTranscribing ? 'Transcribing…' :
              fieldContext    ? `Ask more about ${fieldContext.label}…` :
              cardContext     ? `Ask about ${cardContext.fund_name}…` :
                               'Ask anything — tap a metric above for instant answers'
            }
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none bg-transparent text-sm text-brown placeholder:text-muted focus:outline-none leading-relaxed disabled:opacity-50"
            style={{ maxHeight: '80px', overflowY: 'auto' }}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'
            }}
          />
          <button
            type="button"
            onClick={startVoice}
            disabled={isLoading || isTranscribing}
            className={`shrink-0 h-8 w-8 flex items-center justify-center rounded-xl transition-colors disabled:opacity-40 ${
              isListening ? 'bg-red-500 text-white animate-pulse' : 'text-muted hover:text-terracotta'
            }`}
            title={isListening ? 'Stop & transcribe' : 'Voice input'}
          >
            {isTranscribing
              ? <Loader2 size={14} className="animate-spin" />
              : isListening
                ? <MicOff size={14} />
                : <Mic size={14} />
            }
          </button>
          <Button
            size="sm"
            onClick={() => submit(text)}
            disabled={!text.trim() || isLoading}
            className="shrink-0 h-8 w-8 p-0 rounded-xl"
          >
            <SendHorizonal size={14} />
          </Button>
        </div>
      </div>
    </div>
  )
})
