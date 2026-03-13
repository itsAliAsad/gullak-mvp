import { ArrowLeft } from 'lucide-react'
import { GullakChat } from '@/components/chat/GullakChat'

export function Chat({ sessionId, onBack, onAnalyze }) {
  return (
    <div className="h-dvh flex flex-col bg-cream">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-sand bg-white/80 backdrop-blur-sm shrink-0">
        <button
          onClick={onBack}
          className="text-muted hover:text-brown transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-terracotta-light flex items-center justify-center">
            <span className="text-terracotta text-xs font-bold">G</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-brown leading-none">Gullak</p>
            <p className="text-xs text-muted">AI Fund Analyst</p>
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1 min-h-0">
        <GullakChat
          sessionId={sessionId}
          onAnalyze={onAnalyze}
        />
      </div>
    </div>
  )
}
