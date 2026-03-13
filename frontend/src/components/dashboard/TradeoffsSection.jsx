import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export function TradeoffsSection({ text }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mx-4 rounded-xl border border-sand overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-brown hover:bg-sand/20 transition-colors"
      >
        <span>Why these funds, and not others?</span>
        {open ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
      </button>
      {open && (
        <div className="px-4 pb-4">
          <p className="text-sm text-brown/80 leading-relaxed">{text}</p>
        </div>
      )}
    </div>
  )
}
