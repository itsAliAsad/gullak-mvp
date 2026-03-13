import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Markdown } from '@/components/Markdown'

const ANCHOR_LABELS = {
  top_pick:      'Top Pick',
  comparison:    'How They Compare',
  capture:       'Market Capture',
  expense_ratio: 'Cost',
  goal:          'Your Goal',
  risk:          'Risk Profile',
  expanded_fund: 'Fund Detail',
}

export function RecommendationHero({ reply, narration, onNarrationTap }) {
  const [replyExpanded, setReplyExpanded] = useState(false)

  // Collapse the reply text if it's very long
  const REPLY_LIMIT = 300
  const isLong = reply?.length > REPLY_LIMIT
  const displayedReply = isLong && !replyExpanded
    ? reply.slice(0, REPLY_LIMIT).trimEnd() + '…'
    : reply

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      {/* Main reply */}
      <div>
        <Markdown className="text-base text-brown leading-relaxed font-medium">{displayedReply}</Markdown>
        {isLong && (
          <button
            onClick={() => setReplyExpanded(v => !v)}
            className="mt-1 flex items-center gap-1 text-xs text-terracotta/80 hover:text-terracotta transition-colors"
          >
            {replyExpanded
              ? <><ChevronUp size={12} />Show less</>
              : <><ChevronDown size={12} />Read more</>}
          </button>
        )}
      </div>

      {/* Narration cards — tappable to go deeper */}
      {narration?.length > 0 && (
        <div className="space-y-2">
          {narration.map((item, i) => (
            <button
              key={i}
              onClick={() => onNarrationTap?.(item)}
              className="w-full text-left bg-white/70 border border-sand rounded-xl px-4 py-3 hover:border-terracotta/30 hover:bg-white transition-colors group"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-terracotta uppercase tracking-wide font-semibold">
                  {ANCHOR_LABELS[item.anchor] ?? item.anchor}
                </p>
                <span className="text-[10px] text-muted/50 group-hover:text-terracotta/50 transition-colors">
                  Tap to ask →
                </span>
              </div>
              <Markdown className="text-sm text-brown/85 leading-relaxed">{item.text}</Markdown>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
