import { useEffect, useMemo, useRef } from 'react'

const FALLBACK_EVENTS = [
  {
    id: 'boot',
    agent: 'System',
    status: 'running',
    stage: 'boot',
    timestamp: new Date().toISOString(),
    message: 'Opening the live analyst trace. Waiting for the backend to attach the next checkpoint...',
  },
]

const AGENT_STYLES = {
  System: 'border-white/10 bg-white/10 text-white/70',
  Profiler: 'border-amber-400/30 bg-amber-300/10 text-amber-200',
  Analyst: 'border-emerald-400/30 bg-emerald-300/10 text-emerald-200',
  Orchestrator: 'border-stone-300/20 bg-stone-200/10 text-stone-200',
  Explainer: 'border-sky-400/30 bg-sky-300/10 text-sky-200',
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
    ? 'bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.75)]'
    : 'bg-amber-300 animate-pulse shadow-[0_0_12px_rgba(252,211,77,0.8)]'

  return <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${className}`} />
}

export function Analyzing({ isWaiting = false, progressEvents = [] }) {
  const terminalRef = useRef(null)

  const events = useMemo(
    () => (progressEvents.length ? progressEvents : FALLBACK_EVENTS),
    [progressEvents],
  )

  const latestEvent = events[events.length - 1]
  const analystCount = progressEvents.filter((event) => event.agent === 'Analyst').length

  useEffect(() => {
    const node = terminalRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [events])

  return (
    <div className="h-full overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(196,106,84,0.18),_transparent_32%),linear-gradient(180deg,_#f5ecdf_0%,_#efe2d0_48%,_#ead7c1_100%)] px-6 py-8">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6 lg:grid lg:grid-cols-[0.95fr_1.25fr] lg:items-stretch">
        <section className="rounded-[28px] border border-white/60 bg-white/70 p-7 shadow-[0_24px_80px_rgba(78,52,39,0.12)] backdrop-blur-sm">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-terracotta/20 bg-terracotta/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-terracotta">
            Live Agent Trace
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-brown/55">Agent 2 at work</p>
              <h1 className="mt-3 max-w-md text-4xl font-semibold leading-tight text-brown">
                Judges now watch the recommendation engine think in public.
              </h1>
            </div>

            <p className="max-w-lg text-sm leading-6 text-brown/72">
              Instead of hiding the 60-90 second delay, Gullak streams each material checkpoint in the profiling, filtering, ranking, and explanation pipeline while the shortlist is being built.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-brown/10 bg-brown/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-brown/55">Latest stage</p>
              <p className="mt-2 text-sm font-semibold text-brown">{latestEvent?.stage || 'booting'}</p>
            </div>
            <div className="rounded-2xl border border-brown/10 bg-brown/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-brown/55">Analyst checkpoints</p>
              <p className="mt-2 text-sm font-semibold text-brown">{analystCount || (isWaiting ? 0 : 1)} emitted</p>
            </div>
            <div className="rounded-2xl border border-brown/10 bg-brown/[0.04] p-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-brown/55">Status</p>
              <p className="mt-2 text-sm font-semibold text-brown">{isWaiting ? 'Streaming activity...' : 'Hand-off complete'}</p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-white/70 bg-white/65 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brown/55">Why judges care</p>
            <p className="mt-3 text-sm leading-6 text-brown/72">
              These lines are sourced from the actual backend analysis flow, so the UI now shows strict mandate filtering, risk-adjusted ranking passes, and the confidence gate that finalizes the shortlist before the explanation layer takes over.
            </p>
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-[#2f2a28] bg-[#171312] shadow-[0_28px_90px_rgba(20,12,9,0.42)]">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-white/45">analysis.log</p>
              <p className="mt-1 text-sm text-white/70">Live backend checkpoints for the report pipeline</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/65">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.75)]" />
              {isWaiting ? 'stream attached' : 'stream closed'}
            </div>
          </div>

          <div ref={terminalRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5 font-mono text-sm leading-6 text-white/88">
            {events.map((event) => {
              const agentStyle = AGENT_STYLES[event.agent] || AGENT_STYLES.System

              return (
                <div key={event.id} className="rounded-2xl border border-white/6 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-start gap-3">
                    <StatusDot status={event.status} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/40">
                        <span>{formatEventTime(event.timestamp)}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.16em] ${agentStyle}`}>
                          {event.agent}
                        </span>
                        {event.stage && <span>{event.stage}</span>}
                      </div>
                      <p className="mt-2 break-words text-sm leading-6 text-white/88">
                        <span className="mr-2 text-terracotta">&gt;</span>
                        {event.message}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}

            {isWaiting && (
              <div className="flex items-center gap-3 px-1 text-sm text-white/45">
                <span className="text-terracotta">&gt;</span>
                <span>Awaiting the next agent checkpoint</span>
                <span className="inline-flex h-5 items-end overflow-hidden">
                  <span className="inline-block h-4 w-2 animate-pulse bg-white/70" />
                </span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
