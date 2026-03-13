import { GullakChat } from '@/components/chat/GullakChat'
import { GullakLogo } from '@/components/GullakLogo'

export function Home({ sessionId, onSessionId, onConversing, onProfilingComplete, onRevertToChat, isAnalyzing = false, progressEvents = [] }) {
  return (
    <div className="h-full flex flex-col bg-cream">
      {/* Mobile header */}
      <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-sand bg-white/80 backdrop-blur-sm shrink-0">
        <GullakLogo className="w-8 h-8" />
        <div>
          <p className="text-sm font-semibold text-brown leading-none">Gullak</p>
          <p className="text-xs text-muted">AI Fund Analyst</p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <GullakChat
          sessionId={sessionId}
          onSessionId={onSessionId}
          onConversing={onConversing}
          onProfilingComplete={onProfilingComplete}
          onRevertToChat={onRevertToChat}
          isAnalyzing={isAnalyzing}
          progressEvents={progressEvents}
        />
      </div>
    </div>
  )
}
