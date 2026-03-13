import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { GullakLogo } from '@/components/GullakLogo'

const FALLBACK_EVENT = {
  id: 'trace-boot',
  agent: 'System',
  status: 'running',
  stage: 'boot',
  timestamp: new Date().toISOString(),
  message: 'Opening the live analysis trace.',
  detail: 'The system is waiting for the next backend checkpoint before showing tool activity.',
}

const AGENT_STYLES = {
  System: 'border-brown/10 bg-brown/[0.04] text-brown/65',
  Profiler: 'border-amber-500/20 bg-amber-100/80 text-amber-900/80',
  Analyst: 'border-emerald-500/20 bg-emerald-100/80 text-emerald-900/80',
  Orchestrator: 'border-stone-400/20 bg-stone-100/85 text-stone-900/75',
  Explainer: 'border-sky-500/20 bg-sky-100/85 text-sky-900/75',
}

function formatEventTime(timestamp) {
  if (!timestamp) return '--:--'

  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '--:--'

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function StatusDot({ status }) {
  const className = status === 'completed'
    ? 'bg-emerald-500 shadow-[0_0_10px_rgba(34,197,94,0.35)]'
    : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.35)]'

  return <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${className}`} />
}

export function AnalysisTraceCard({ events = [], isActive = false }) {
  const listRef = useRef(null)
  const traceEvents = useMemo(() => (events.length ? events : [FALLBACK_EVENT]), [events])
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  useEffect(() => {
    const node = listRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [traceEvents])

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-start gap-3">
        <GullakLogo className="mt-0.5 h-7 w-7 shrink-0 rounded-lg" />
        <div className="max-w-[85%] min-w-0 rounded-2xl rounded-tl-sm border border-sand bg-white px-4 py-4 shadow-[0_18px_50px_rgba(82,52,35,0.08)] sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-brown/10 pb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-terracotta">Live analysis trace</p>
              <p className="mt-1 text-sm text-brown/72">Backend checkpoints, reasoning summaries, and actual tool usage</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brown/10 bg-terracotta-light/65 px-3 py-1 text-[11px] font-medium text-brown/65">
              <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-brown/35'}`} />
              {isActive ? 'streaming' : 'trace paused'}
            </div>
          </div>

          <div ref={listRef} className="mt-4 max-h-[26rem] space-y-3 overflow-y-auto pr-1">
            {traceEvents.map((event) => {
              const isExpanded = expandedIds.has(event.id)
              const canExpand = Boolean(event.detail || event.tool)
              const agentStyle = AGENT_STYLES[event.agent] || AGENT_STYLES.System

              return (
                <div key={event.id} className="rounded-2xl border border-[#d7c1a8] bg-[#e6d4c2] px-4 py-3">
                  <div className="flex items-start gap-3">
                    <StatusDot status={event.status} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-brown/45">
                        <span>{formatEventTime(event.timestamp)}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.16em] ${agentStyle}`}>
                          {event.agent}
                        </span>
                        {event.stage && <span>{event.stage}</span>}
                        {event.tool && (
                          <span className="rounded-full border border-terracotta/20 bg-terracotta/10 px-2 py-0.5 text-[10px] font-semibold tracking-[0.16em] text-terracotta">
                            {event.tool}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm leading-6 text-brown">{event.message}</p>

                      {canExpand && (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(event.id)}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-terracotta transition-colors hover:text-brown"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          {isExpanded ? 'Hide reasoning' : 'Show reasoning'}
                        </button>
                      )}

                      {isExpanded && (
                        <div className="mt-3 rounded-2xl border border-brown/10 bg-[#d7c1a8] px-3 py-3 text-sm text-brown/78">
                          {event.detail && (
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brown/45">Reasoning</p>
                              <p className="mt-1 leading-6">{event.detail}</p>
                            </div>
                          )}
                          {event.tool && (
                            <div className={event.detail ? 'mt-3' : ''}>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brown/45">Tool used</p>
                              <p className="mt-1 leading-6 text-brown">{event.tool}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {isActive && (
              <div className="flex items-center gap-3 px-1 text-sm text-brown/55">
                <span className="text-terracotta">&gt;</span>
                <span>Awaiting the next backend checkpoint</span>
                <span className="inline-flex h-5 items-end overflow-hidden">
                  <span className="inline-block h-4 w-2 animate-pulse bg-brown/60" />
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}