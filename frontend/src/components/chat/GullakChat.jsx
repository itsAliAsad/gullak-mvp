import { useState, useRef, useCallback, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { TypingIndicator } from './TypingIndicator'
import { GullakLogo } from '@/components/GullakLogo'
import { SendHorizonal, Mic, MicOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { sendChat, transcribeAudio } from '@/lib/api'
import { Markdown } from '@/components/Markdown'
import { AnalysisTraceCard } from './AnalysisTraceCard'
import { TARGET_SAMPLE_RATE, mergeFloat32Chunks, downsampleAudioBuffer, floatTo16BitPCM, pcm16ToBase64 } from '@/lib/audioRecording'

const GREETING =
  `**Tell me what you're saving for, and I'll help you find the right funds to match it.**`

const SUGGESTIONS = [
  "Saving for my child's university in 10 years",
  "Planning my wedding in 2–3 years",
  "Building a down payment for a house",
  "I want halal investments only",
  "I earn 80K/month — where do I start?",
  "Something safer than a savings account",
  "Saving for Hajj in 5 years",
]

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function MessageBubble({ message }) {
  const isUser = message.from === 'user'

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="max-w-[80%] bg-terracotta text-white rounded-2xl rounded-tr-sm px-4 py-3">
          <p className="text-sm leading-relaxed">{message.content}</p>
        </div>
        {message.timestamp && (
          <p className="text-[10px] text-muted/50 pr-1">{formatTime(message.timestamp)}</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-start gap-3">
        <GullakLogo className="w-7 h-7 shrink-0 mt-0.5 rounded-lg" />
        <div className="max-w-[85%] bg-white border border-sand rounded-2xl rounded-tl-sm px-4 py-3">
          <Markdown className="text-sm text-brown leading-relaxed">{message.content}</Markdown>
        </div>
      </div>
      {message.timestamp && (
        <p className="text-[10px] text-muted/50 pl-10">{formatTime(message.timestamp)}</p>
      )}
    </div>
  )
}

// Quick-reply buttons displayed below the last agent message.
function QuickReplyButtons({ options, onSelect, disabled }) {
  if (!options?.options?.length) return null
  return (
    <div className="pl-10">
      <div className="flex flex-wrap gap-2 mt-2">
        {options.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            disabled={disabled}
            className="text-xs border border-terracotta/40 text-terracotta rounded-full px-3 py-1.5 hover:bg-terracotta/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted/50 mt-1.5">
        Don't see your answer? Type it in the box below.
      </p>
    </div>
  )
}

export function GullakChat({
  sessionId: initialSessionId,
  onSessionId,
  onConversing,
  onProfilingComplete,
  onRevertToChat,
  isAnalyzing = false,
  progressEvents = [],
}) {
  const [messages, setMessages] = useState([
    {
      id: 'greeting',
      from: 'assistant',
      content: GREETING,
      timestamp: Date.now(),
    },
  ])
  const [currentOptions, setCurrentOptions] = useState(null)
  const [text, setText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const [isListening, setIsListening]         = useState(false)
  const [isTranscribing, setIsTranscribing]   = useState(false)
  const sessionIdRef        = useRef(initialSessionId)
  const lastProfilingStateRef = useRef(null)
  const mediaStreamRef      = useRef(null)
  const audioContextRef     = useRef(null)
  const processorRef        = useRef(null)
  const pcmSamplesRef       = useRef([])
  const bottomRef           = useRef(null)
  const textareaRef         = useRef(null)

  // Keep the ref in sync if the parent updates sessionId after first response
  useEffect(() => {
    sessionIdRef.current = initialSessionId
  }, [initialSessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, progressEvents.length, isAnalyzing])

  const handleSubmit = useCallback(async (inputText) => {
    const trimmed = inputText.trim()
    if (!trimmed || isLoading) return

    setShowSuggestions(false)
    setCurrentOptions(null)
    setText('')

    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      from: 'user',
      content: trimmed,
      timestamp: Date.now(),
    }])

    setIsLoading(true)

    // If user is answering after the LIQUIDITY state, the backend will run the full
    // analysis next (no more profiling turns). Switch to the analyzing screen now
    // so the user doesn't watch a chat spinner for 60-100s.
    const TERMINAL_STATES = ['LIQUIDITY', 'SUMMARY', 'COMPLETE']
    if (TERMINAL_STATES.includes(lastProfilingStateRef.current)) {
      onProfilingComplete?.()
    }

    try {
      const response = await sendChat(sessionIdRef.current, trimmed)

      // Store session_id from first response
      if (response.session_id && response.session_id !== sessionIdRef.current) {
        sessionIdRef.current = response.session_id
        onSessionId?.(response.session_id)
      }

      setMessages(prev => [...prev, {
        id: `assistant-${Date.now()}`,
        from: 'assistant',
        content: response.reply,
        timestamp: Date.now(),
      }])

      if (response.phase === 'PROFILING') {
        lastProfilingStateRef.current = response.state ?? null
        setCurrentOptions(response.options || null)
        // If we eagerly switched to analyzing but the agent asked another question, revert
        onRevertToChat?.()
        if (response.is_complete) {
          onProfilingComplete?.()
        }
      } else if (response.phase === 'CONVERSING') {
        // Hand off to App — triggers analyzing screen → dashboard
        onConversing?.(response)
      }
    } catch (err) {
      console.error('Chat error:', err)
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        from: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: Date.now(),
      }])
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, onSessionId, onConversing, onProfilingComplete, onRevertToChat])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(text)
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
        description: 'Please try again in a quieter environment or type your message.',
      })
    } finally {
      setIsTranscribing(false)
    }
  }, [])

  const startVoice = useCallback(async () => {
    if (isListening) { stopRecording(); return }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current  = stream
      pcmSamplesRef.current   = []

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
    } catch (e) {
      console.error('Microphone error:', e)
      toast.error('Microphone access failed', {
        description: 'Please check your browser microphone permissions and try again.',
      })
    }
  }, [isListening, stopRecording])

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 min-h-0">
        <div className="pt-8 pb-4 flex flex-col items-center">
          <div className="w-full max-w-[700px] px-4 space-y-4">
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {(isAnalyzing || progressEvents.length > 0) && (
              <AnalysisTraceCard events={progressEvents} isActive={isAnalyzing} />
            )}
            {/* Quick-reply buttons attached to the last assistant message */}
            {!isLoading && currentOptions && (
              <QuickReplyButtons
                options={currentOptions}
                onSelect={(val) => handleSubmit(val)}
                disabled={isLoading}
              />
            )}
            {isLoading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        </div>
      </ScrollArea>

      {/* Suggestion chips — only shown before the first user message */}
      {showSuggestions && (
        <div className="w-full max-w-[700px] mx-auto px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => handleSubmit(s)}
              className="shrink-0 text-xs text-muted border border-sand rounded-full px-3 py-1.5 hover:bg-sand/40 hover:text-brown transition-colors whitespace-nowrap"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Text input */}
      <div className="w-full max-w-[700px] mx-auto px-4 pb-8 pt-2">
        <div className="flex items-end gap-2 bg-cream border border-sand rounded-2xl px-4 py-3 min-h-[50px] focus-within:border-terracotta/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? 'Recording… tap mic to send' : isTranscribing ? 'Transcribing…' : 'Tell me about your financial goals...'}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-brown placeholder:text-muted focus:outline-none leading-relaxed self-center"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
          <button
            type="button"
            onClick={startVoice}
            disabled={isLoading || isTranscribing}
            className={`shrink-0 h-10 w-10 flex items-center justify-center rounded-xl transition-colors disabled:opacity-40 ${
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'text-muted hover:text-terracotta'
            }`}
            title={isListening ? 'Stop & transcribe' : 'Voice input'}
          >
            {isTranscribing
              ? <Loader2 size={17} className="animate-spin" />
              : isListening
                ? <MicOff size={17} />
                : <Mic size={17} />
            }
          </button>
          <Button
            size="sm"
            onClick={() => handleSubmit(text)}
            disabled={!text.trim() || isLoading}
            className="shrink-0 h-10 w-10 p-0 rounded-xl"
          >
            <SendHorizonal size={17} />
          </Button>
        </div>
        <p className="text-[10px] text-center text-muted/60 mt-2">
          All funds are SECP-regulated. This is not financial advice.
        </p>
      </div>
    </div>
  )
}
