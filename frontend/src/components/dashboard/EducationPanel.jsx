import { X } from 'lucide-react'
import { Markdown } from '@/components/Markdown'

export function EducationPanel({ education, onClose }) {
  if (!education) return null

  return (
    <div className="mx-4 my-2 bg-white border border-terracotta/20 rounded-2xl p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-xs text-terracotta uppercase tracking-wide font-semibold">
          {education.field?.replace(/_/g, ' ')}
        </p>
        <button onClick={onClose} className="text-muted hover:text-brown transition-colors shrink-0">
          <X size={14} />
        </button>
      </div>

      <div className="space-y-2.5">
        <div>
          <p className="text-xs text-muted font-medium mb-0.5">What it means</p>
          <Markdown className="text-sm text-brown leading-relaxed">{education.definition}</Markdown>
        </div>
        <div>
          <p className="text-xs text-muted font-medium mb-0.5">For this fund</p>
          <Markdown className="text-sm text-brown leading-relaxed">{education.in_context}</Markdown>
        </div>
        <div>
          <p className="text-xs text-muted font-medium mb-0.5">Why it matters for your goal</p>
          <Markdown className="text-sm text-brown leading-relaxed">{education.why_it_matters}</Markdown>
        </div>
      </div>
    </div>
  )
}
