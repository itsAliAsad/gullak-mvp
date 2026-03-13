import { GullakLogo } from '@/components/GullakLogo'

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <GullakLogo className="w-7 h-7 shrink-0 mt-0.5 rounded-lg" />
      <div className="bg-white border border-sand rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}
