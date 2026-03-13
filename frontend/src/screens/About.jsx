import {
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle,
  Clock3,
  Database,
  FileSearch,
  Globe,
  Layers3,
  MessageSquare,
  Mic,
  Radio,
  Server,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

function Section({ className = '', children }) {
  return (
    <section className={`max-w-6xl mx-auto px-6 py-16 ${className}`}>
      {children}
    </section>
  )
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs uppercase tracking-[0.22em] text-terracotta font-semibold mb-3">
      {children}
    </p>
  )
}

function SectionHeading({ children }) {
  return (
    <h2 className="text-3xl md:text-4xl font-bold text-brown leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
      {children}
    </h2>
  )
}

function Panel({ className = '', children }) {
  return (
    <div className={`rounded-[24px] border border-sand shadow-[0_18px_50px_rgba(44,26,14,0.06)] ${className}`}>
      {children}
    </div>
  )
}

function StatBadge({ children }) {
  return (
    <span className="rounded-full border border-white/60 bg-white/80 px-4 py-2 text-sm font-medium text-brown backdrop-blur-sm">
      {children}
    </span>
  )
}

function MetricCard({ icon: Icon, label, value, detail }) {
  return (
    <Panel className="bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-terracotta-light text-terracotta">
          <Icon size={18} />
        </div>
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted">As built</span>
      </div>
      <div className="text-3xl font-bold text-brown">{value}</div>
      <div className="mt-1 text-sm font-semibold text-brown">{label}</div>
      <p className="mt-3 text-sm leading-relaxed text-muted">{detail}</p>
    </Panel>
  )
}

function DiagramNode({ icon: Icon, title, body, tone = 'white', className = '' }) {
  const tones = {
    white: 'bg-white border-sand',
    cream: 'bg-cream border-sand',
    accent: 'bg-terracotta text-white border-terracotta',
  }

  const textTone = tone === 'accent' ? 'text-white/80' : 'text-muted'
  const iconTone = tone === 'accent' ? 'bg-white/15 text-white' : 'bg-terracotta-light text-terracotta'

  return (
    <div className={`rounded-3xl border p-4 shadow-[0_12px_30px_rgba(44,26,14,0.06)] ${tones[tone]} ${className}`}>
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-2xl ${iconTone}`}>
        <Icon size={18} />
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <p className={`mt-2 text-xs leading-relaxed ${textTone}`}>{body}</p>
    </div>
  )
}

const JUDGE_METRICS = [
  {
    icon: Database,
    label: 'Funds In Runtime Dataset',
    value: '522',
    detail: 'The Lambda cold-start loads fund_features.json once and serves shortlist generation from a precomputed 2 MB intelligence file.',
  },
  {
    icon: Brain,
    label: 'Agents In The Loop',
    value: '3 + 1',
    detail: 'Profiler, Analyst, and Explainer drive the user journey, while a separate progress narrator produces live analysis updates.',
  },
  {
    icon: Clock3,
    label: 'Initial Analysis Time',
    value: '60–90s',
    detail: 'The first recommendation run performs the full Bedrock-backed analysis pipeline and streams progress over WebSocket or polling fallback.',
  },
  {
    icon: ShieldCheck,
    label: 'Hard Constraints',
    value: 'Shariah + Suitability',
    detail: 'Shariah preference is enforced as a hard filter, while shortlist weights shift by risk tolerance and time horizon rather than generic popularity.',
  },
]

const JOURNEY_STEPS = [
  {
    step: '01',
    icon: MessageSquare,
    title: 'Profile in conversation, not a form',
    body: 'The frontend keeps the user on one chat surface while the Profiler agent fills investment amount, horizon, risk tolerance, language, liquidity needs, and a synthesized goal summary.',
    detail: 'Quick replies, English or Urdu, and optional target amount extraction are all persisted in session state.',
  },
  {
    step: '02',
    icon: Brain,
    title: 'Run the analyst stack against the full fund universe',
    body: 'Once profiling is complete, the same backend request hands off to the Analyst, which filters, scores, and ranks the live 522-fund dataset using weighted composite scores.',
    detail: 'Weights change across 9 presets based on risk and horizon, and missing capture scores are renormalized instead of penalized.',
  },
  {
    step: '03',
    icon: Sparkles,
    title: 'Explain the shortlist in plain language',
    body: 'The Explainer converts ranking output into opening narration, metric education panels, fund-specific follow-ups, and confirmation-gated reanalysis flows.',
    detail: 'Users can tap metrics, tap a fund, or ask what-if questions and receive a contextual answer instead of raw data tables.',
  },
]

const AGENT_CARDS = [
  {
    icon: MessageSquare,
    title: 'Profiler Agent',
    body: 'Amazon Bedrock Claude Haiku 4.5 collects the investor profile over multiple turns and drives validated quick replies.',
  },
  {
    icon: BarChart3,
    title: 'Analyst Agent',
    body: 'Amazon Bedrock Claude Sonnet 4.5 filters, ranks, and reasons over the precomputed fund intelligence layer.',
  },
  {
    icon: Sparkles,
    title: 'Explainer Agent',
    body: 'Amazon Bedrock Claude Sonnet 4.5 turns the shortlist into narratives, education blocks, and reanalysis requests.',
  },
  {
    icon: Radio,
    title: 'Progress Narrator',
    body: 'A separate Bedrock helper generates live stage copy so judges can see that work is happening while analysis is underway.',
  },
]

const AWS_STACK = [
  {
    icon: Server,
    name: 'AWS Lambda Function URL',
    role: 'One Lambda handles the main POST chat flow, GET /progress polling, POST /transcribe, and the cross-agent orchestration logic.',
  },
  {
    icon: Radio,
    name: 'API Gateway WebSocket API',
    role: 'Clients subscribe to analysis progress in real time, and the backend pushes fresh snapshots after each stored progress event.',
  },
  {
    icon: Database,
    name: 'Amazon DynamoDB',
    role: 'Session state, reanalysis counters, message history, progress traces, and WebSocket subscriber mappings are stored in one table.',
  },
  {
    icon: Brain,
    name: 'Amazon Bedrock',
    role: 'Claude Haiku 4.5 powers profiling. Claude Sonnet 4.5 powers analysis, explanation, and progress narration.',
  },
  {
    icon: Mic,
    name: 'Amazon Transcribe Streaming',
    role: 'Voice input is accepted through the backend and converted into transcripts for the same conversational flow.',
  },
  {
    icon: Layers3,
    name: 'Cold-Loaded Runtime Data',
    role: 'fund_features.json is loaded at module import so the analyst can query a ready-to-use structured dataset with minimal runtime overhead.',
  },
]

const PIPELINE_STAGES = [
  {
    title: '1. MUFAP master registry',
    body: 'scrape_fund_directory.py creates the identity-safe fund registry with category, AMC, fund type, NAV, and Shariah flag.',
  },
  {
    title: '2. NAV history ingestion',
    body: 'scrape_nav_daily.py pulls daily NAV data in chunks, validates fund IDs, and filters non-trading duplicate snapshots.',
  },
  {
    title: '3. Expense ratio ingestion',
    body: 'scrape_expense_ratios.py adds TER data and validates each row against the registry rather than guessing joins.',
  },
  {
    title: '4. Official returns ingestion',
    body: 'scrape_fund_returns.py calls the MUFAP fund detail API and keeps official return figures instead of recomputing them from NAV.',
  },
  {
    title: '5. Benchmark history ingestion',
    body: 'scrape_benchmark_daily.py normalizes PSX benchmark history, deduplicates exact repeats, and rejects conflicting records.',
  },
  {
    title: '6. Deterministic benchmark policy',
    body: 'resolve_benchmark_names.py applies explicit category-to-benchmark rules so benchmark metrics are explainable and auditable.',
  },
  {
    title: '7. Feature computation',
    body: 'compute_fund_features.py generates the final fund_features.json artifact with returns, risk, benchmark-relative metrics, cost fields, and normalized composite scores.',
  },
]

const DIFFERENTIATORS = [
  {
    icon: Users,
    title: 'Built for Pakistani retail investors',
    body: 'The experience is tuned for first-time investors, goal-based savers, Shariah-conscious users, and experienced investors seeking a second opinion.',
  },
  {
    icon: Workflow,
    title: 'Stateful and re-runnable',
    body: 'The conversation can move from profiling to analysis to follow-up and rerun the shortlist up to three times when the user changes their profile.',
  },
  {
    icon: FileSearch,
    title: 'Deterministic underneath the AI',
    body: 'The LLMs explain and reason, but the actual fund intelligence comes from a deterministic scraping and feature-computation pipeline with explicit quality checks.',
  },
  {
    icon: Globe,
    title: 'Designed to show its work',
    body: 'Progress traces, narration cards, education panels, and shortlist reasons all surface what the backend is doing instead of hiding it behind one opaque answer.',
  },
]

const NEXT_PHASE_ITEMS = [
  {
    title: 'Portfolio Watch Agent',
    status: 'Natural next feature',
    body: 'After a user picks funds, Gullak should move from one-time advice to ongoing monitoring. The next agent would watch existing holdings, explain drawdowns, flag expense-ratio changes, surface benchmark drift, and tell the investor whether a change matters or is just market noise.',
  },
  {
    title: 'Automated refresh jobs',
    status: 'Operational next step',
    body: 'The data pipeline is already broken into deterministic stages. The next production step is scheduling those scripts as regular refresh jobs so directory, NAV, returns, benchmark, and feature computation run automatically instead of being manually kicked off.',
  },
  {
    title: 'Cron-style orchestration on AWS',
    status: 'Infrastructure next step',
    body: 'A practical next move is EventBridge schedules that trigger the pipeline cadence described in the spec: daily directory, NAV, returns, benchmark, and feature generation; monthly or on-demand expense ratio refreshes; and periodic risk-free-rate updates with validation.',
  },
  {
    title: 'Persistent user layer',
    status: 'Product next step',
    body: 'Today sessions are anonymous and UUID-backed. The next phase would add authenticated users, saved watchlists or portfolios, alert preferences, and historical recommendation context so Gullak can remember what a user owns and why it recommended it.',
  },
]

const NEXT_PHASE_STREAMS = [
  {
    icon: Workflow,
    title: 'Turn the MVP into a loop, not a one-off chat',
    body: 'The current MVP proves discovery and explanation. The next product phase turns that into a recurring workflow: analyze, invest, monitor, explain, and re-evaluate over time.',
  },
  {
    icon: Radio,
    title: 'Promote the scraping pipeline into scheduled infrastructure',
    body: 'The article already defines the stage order and refresh cadence. The next step is wrapping those scripts in scheduled jobs with run metadata, failure recovery, and freshness reporting.',
  },
  {
    icon: Layers3,
    title: 'Expand the intelligence layer',
    body: 'Future iterations can add richer benchmark history, comparison views, source snapshots for auditability, and eventually a live refresh path instead of relying on a static packaged dataset.',
  },
]

function Hero({ onTryGullak }) {
  return (
    <div className="relative overflow-hidden border-b border-sand bg-[linear-gradient(180deg,#fff6ee_0%,#faf6f1_58%,#ffffff_100%)]">
      <div className="absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,_rgba(196,98,45,0.18),_transparent_60%)]" />
      <Section className="relative py-20 md:py-24">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-terracotta">
              Gullak · AWS AI Hackathon · As-built MVP
            </p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight text-brown md:text-6xl" style={{ fontFamily: 'Georgia, serif' }}>
              An AI mutual fund advisor that explains every recommendation like a human analyst would.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-muted md:text-lg">
              Gullak guides a Pakistani retail investor through profiling, scores a 522-fund universe against their needs, and returns a shortlist with plain-language explanations, live backend progress, and interactive follow-up education.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <StatBadge>522 mutual funds</StatBadge>
              <StatBadge>3 AI agents + live progress narrator</StatBadge>
              <StatBadge>Single Lambda backend</StatBadge>
              <StatBadge>React + Vite frontend</StatBadge>
            </div>
            {onTryGullak && (
              <div className="mt-10">
                <Button size="lg" onClick={onTryGullak} className="gap-2 shadow-[0_12px_30px_rgba(196,98,45,0.18)]">
                  Try Gullak
                  <ArrowRight size={16} />
                </Button>
              </div>
            )}
          </div>

          <Panel className="overflow-hidden bg-brown text-white">
            <div className="border-b border-white/10 px-6 py-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Judge snapshot</p>
              <h2 className="mt-2 text-2xl font-semibold" style={{ fontFamily: 'Georgia, serif' }}>
                What this demo proves
              </h2>
            </div>
            <div className="space-y-4 px-6 py-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/60">Personalization</div>
                <p className="mt-2 text-sm leading-7 text-white/85">
                  The shortlist is not static. Risk tolerance, horizon, liquidity needs, Shariah preference, and optional target amount all change what survives and how it is ranked.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/60">Explainability</div>
                <p className="mt-2 text-sm leading-7 text-white/85">
                  Users can inspect metrics, ask why a fund was chosen, and trigger controlled reanalysis instead of receiving a black-box answer.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/60">Production shape</div>
                <p className="mt-2 text-sm leading-7 text-white/85">
                  The system uses AWS managed services end-to-end: Bedrock for reasoning, Lambda for orchestration, DynamoDB for sessions, WebSockets for progress, and Transcribe for voice input.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </Section>
    </div>
  )
}

function JudgeMetrics() {
  return (
    <div className="border-b border-sand bg-white">
      <Section>
        <SectionLabel>Why It Matters</SectionLabel>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <SectionHeading>Built for judges to inspect the full stack, not just the chat UI.</SectionHeading>
          <p className="max-w-xl text-sm leading-7 text-muted">
            The PRD and pipeline spec describe an end-to-end system: deterministic data ingestion, agent orchestration, live progress tracking, and an interactive recommendation surface. This page now mirrors that implementation.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {JUDGE_METRICS.map((metric) => (
            <MetricCard key={metric.label} {...metric} />
          ))}
        </div>
      </Section>
    </div>
  )
}

function Journey() {
  return (
    <div className="border-b border-sand bg-cream">
      <Section>
        <SectionLabel>Product Flow</SectionLabel>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <SectionHeading>What happens between “I want to invest” and a final shortlist.</SectionHeading>
          <p className="max-w-xl text-sm leading-7 text-muted">
            The user journey follows the implemented state machine: PROFILING to ANALYZING to CONVERSING, with a confirmation-gated REANALYZING branch when the user changes assumptions.
          </p>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {JOURNEY_STEPS.map((item) => (
            <Panel key={item.step} className="bg-white p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">Step {item.step}</span>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-terracotta-light text-terracotta">
                  <item.icon size={18} />
                </div>
              </div>
              <h3 className="mt-5 text-xl font-semibold text-brown">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted">{item.body}</p>
              <p className="mt-4 border-t border-sand pt-4 text-xs leading-6 text-muted">{item.detail}</p>
            </Panel>
          ))}
        </div>
      </Section>
    </div>
  )
}

function Architecture() {
  return (
    <div className="border-b border-sand bg-white">
      <Section>
        <SectionLabel>Architecture</SectionLabel>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <SectionHeading>A judge-friendly view of the runtime system.</SectionHeading>
          <p className="max-w-xl text-sm leading-7 text-muted">
            The application is intentionally simple at the edge and rich in orchestration underneath: one frontend, one Lambda entry point, several AWS services, and four coordinated AI workers.
          </p>
        </div>

        <Panel className="relative mt-10 overflow-hidden bg-white p-6 md:p-8">
          <div className="absolute inset-x-12 top-0 h-36 bg-[radial-gradient(circle,_rgba(196,98,45,0.14),_transparent_70%)]" />

          <div className="relative hidden lg:block">
            <div className="mx-auto max-w-[240px]">
              <DiagramNode
                icon={Globe}
                title="React + Vite Browser App"
                body="Profiling chat, analyzing screen, dashboard cards, metric education panel, and follow-up Q&A live in one interface."
                tone="cream"
              />
            </div>

            <div className="mx-auto h-12 w-px bg-sand" />

            <div className="mx-auto max-w-[300px]">
              <DiagramNode
                icon={Server}
                title="Lambda Orchestrator"
                body="Routes POST /, GET /progress, POST /transcribe, and WebSocket events. It owns phase transitions, session persistence, progress snapshots, and reanalysis limits."
                tone="accent"
              />
            </div>

            <div className="relative mx-auto mt-10 grid max-w-5xl grid-cols-[1fr_1.15fr_1fr] gap-8">
              <div className="absolute left-1/2 top-[-28px] h-8 w-px -translate-x-1/2 bg-sand" />
              <div className="absolute left-[16.666%] right-[16.666%] top-0 h-px bg-sand" />
              <div className="absolute left-[16.666%] top-0 h-8 w-px bg-sand" />
              <div className="absolute left-1/2 top-0 h-8 w-px -translate-x-1/2 bg-sand" />
              <div className="absolute right-[16.666%] top-0 h-8 w-px bg-sand" />

              <div className="space-y-4 pt-8">
                <DiagramNode
                  icon={Radio}
                  title="API Gateway WebSocket"
                  body="subscribeProgress and ping power live analysis updates, with GET /progress as polling fallback."
                />
                <DiagramNode
                  icon={Mic}
                  title="Amazon Transcribe"
                  body="Voice input is accepted as PCM audio, transcribed, and fed back into the same profiling flow."
                />
              </div>

              <div className="pt-8">
                <Panel className="border-terracotta/20 bg-[linear-gradient(180deg,rgba(245,230,220,0.35),#ffffff)] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-terracotta">Agent layer</p>
                      <h3 className="mt-2 text-lg font-semibold text-brown">Bedrock-powered reasoning stack</h3>
                    </div>
                    <Brain size={20} className="text-terracotta" />
                  </div>
                  <div className="mt-5 grid gap-3">
                    {AGENT_CARDS.map((agent) => (
                      <div key={agent.title} className="rounded-2xl border border-sand bg-white p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-terracotta-light text-terracotta">
                            <agent.icon size={16} />
                          </div>
                          <div className="text-sm font-semibold text-brown">{agent.title}</div>
                        </div>
                        <p className="mt-3 text-xs leading-6 text-muted">{agent.body}</p>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              <div className="space-y-4 pt-8">
                <DiagramNode
                  icon={Database}
                  title="Amazon DynamoDB"
                  body="Stores phase, investor profile, shortlist, chat history, progress events, pending reanalysis fields, and subscriber mappings."
                />
                <DiagramNode
                  icon={Layers3}
                  title="fund_features.json"
                  body="The analyst reads a structured universe of fund return, risk, cost, and benchmark metrics that was computed offline."
                />
              </div>
            </div>
          </div>

          <div className="relative space-y-4 lg:hidden">
            <DiagramNode
              icon={Globe}
              title="Browser frontend"
              body="React + Vite hosts the profiling chat, analyzing progress screen, and recommendation dashboard."
              tone="cream"
            />
            <div className="mx-auto h-6 w-px bg-sand" />
            <DiagramNode
              icon={Server}
              title="Lambda orchestrator"
              body="One backend entry point routes chat, progress polling, transcription, WebSocket subscriptions, and agent handoffs."
              tone="accent"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <DiagramNode
                icon={Brain}
                title="Bedrock agents"
                body="Profiler, Analyst, Explainer, and Progress Narrator work off the same session state."
              />
              <DiagramNode
                icon={Database}
                title="DynamoDB sessions"
                body="Every phase transition, progress event, and follow-up context is stored for continuity."
              />
              <DiagramNode
                icon={Radio}
                title="WebSocket progress"
                body="Analysis updates stream live, with GET /progress as a fallback path."
              />
              <DiagramNode
                icon={Mic}
                title="Transcribe + runtime dataset"
                body="Voice input and fund intelligence both connect into the same orchestration layer."
              />
            </div>
          </div>
        </Panel>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {AWS_STACK.map((service) => (
            <Panel key={service.name} className="bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-terracotta-light text-terracotta">
                  <service.icon size={18} />
                </div>
                <h3 className="text-sm font-semibold text-brown">{service.name}</h3>
              </div>
              <p className="mt-4 text-sm leading-7 text-muted">{service.role}</p>
            </Panel>
          ))}
        </div>
      </Section>
    </div>
  )
}

function Pipeline() {
  return (
    <div className="border-b border-sand bg-cream">
      <Section>
        <SectionLabel>Data Pipeline</SectionLabel>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <SectionHeading>The recommendation engine works because the data layer is explicit and refreshable.</SectionHeading>
          <p className="max-w-xl text-sm leading-7 text-muted">
            FundLens is not a vague data source. It is a deterministic scraping and feature-computation pipeline that consolidates MUFAP, PSX, and SBP inputs into one machine-readable artifact for the agents.
          </p>
        </div>

        <div className="mt-10 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel className="bg-white p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-terracotta">Source inputs</p>
            <div className="mt-5 grid gap-3">
              {[
                'MUFAP fund directory',
                'MUFAP daily NAV history',
                'MUFAP expense ratio view',
                'MUFAP official returns API',
                'PSX benchmark history',
                'SBP risk-free rate file',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-sand bg-cream p-4 text-sm text-brown">
                  <CheckCircle size={16} className="shrink-0 text-terracotta" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-dashed border-sand bg-white p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Output contract</p>
              <p className="mt-2 text-sm leading-7 text-muted">
                The pipeline emits fund_features.json with run metadata, input file references, summary counters, and per-fund records spanning identity, returns, risk, benchmark-relative metrics, cost, and composite scores.
              </p>
            </div>
          </Panel>

          <div className="space-y-3">
            {PIPELINE_STAGES.map((stage) => (
              <Panel key={stage.title} className="bg-white p-5">
                <h3 className="text-sm font-semibold text-brown">{stage.title}</h3>
                <p className="mt-2 text-sm leading-7 text-muted">{stage.body}</p>
              </Panel>
            ))}
          </div>
        </div>
      </Section>
    </div>
  )
}

function Differentiators() {
  return (
    <div className="border-b border-sand bg-white">
      <Section>
        <SectionLabel>Product Edge</SectionLabel>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <SectionHeading>What makes Gullak more than a chatbot on top of finance data.</SectionHeading>
          <p className="max-w-xl text-sm leading-7 text-muted">
            The product is tailored to Pakistani mutual fund discovery, but it is designed with enough system rigor that the frontend can expose how the backend is actually thinking and updating.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {DIFFERENTIATORS.map((item) => (
            <Panel key={item.title} className="bg-white p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-terracotta-light text-terracotta">
                  <item.icon size={18} />
                </div>
                <h3 className="text-lg font-semibold text-brown">{item.title}</h3>
              </div>
              <p className="mt-4 text-sm leading-7 text-muted">{item.body}</p>
            </Panel>
          ))}
        </div>
      </Section>
    </div>
  )
}

function BeyondMVP() {
  return (
    <div className="border-b border-sand bg-[linear-gradient(180deg,#fffaf4_0%,#fff3e8_100%)]">
      <Section>
        <SectionLabel>Beyond The MVP</SectionLabel>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <SectionHeading>This demo is the first production-shaped slice, not the full platform.</SectionHeading>
          <p className="max-w-xl text-sm leading-7 text-muted">
            The MVP proves the core loop: profile the investor, analyze the full fund universe, and explain the shortlist clearly. The next stage is about turning that into a continuously refreshed, monitorable product with persistent user value after the first recommendation.
          </p>
        </div>

        <Panel className="mt-10 overflow-hidden bg-brown text-white">
          <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="border-b border-white/10 p-6 lg:border-b-0 lg:border-r">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">What exists today</p>
              <h3 className="mt-3 text-2xl font-semibold" style={{ fontFamily: 'Georgia, serif' }}>
                A complete recommendation MVP
              </h3>
              <p className="mt-4 text-sm leading-7 text-white/80">
                Users can profile themselves conversationally, trigger a full 522-fund analysis, inspect the rationale, ask follow-up questions, tap into metric education, and re-run the shortlist when their assumptions change.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  'Conversational profiling with session persistence',
                  'Analyst scoring engine with weighted shortlist generation',
                  'Explainer follow-up chat and education overlays',
                  'Live progress updates through WebSocket and polling fallback',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <CheckCircle size={16} className="mt-0.5 shrink-0 text-white" />
                    <span className="text-sm leading-6 text-white/85">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">What comes next</p>
              <div className="mt-4 space-y-3">
                {NEXT_PHASE_ITEMS.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <h4 className="text-sm font-semibold text-white">{item.title}</h4>
                      <span className="text-[11px] uppercase tracking-[0.16em] text-white/55">{item.status}</span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-white/80">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <Panel className="bg-white p-6">
            <p className="text-xs uppercase tracking-[0.18em] text-terracotta">Operationalizing FundLens</p>
            <h3 className="mt-3 text-2xl font-semibold text-brown" style={{ fontFamily: 'Georgia, serif' }}>
              The pipeline is already staged. The next step is scheduling it.
            </h3>
            <p className="mt-4 text-sm leading-7 text-muted">
              The scraping article already specifies a production-friendly cadence. What is missing is the job runner around it: scheduled execution, logging, freshness tracking, and recovery for partial failures.
            </p>
            <div className="mt-6 space-y-3">
              {[
                'Daily: refresh fund directory, NAV history, official returns, benchmark history, and recompute fund_features.json.',
                'Monthly or on demand: refresh expense ratios unless the business needs a denser history.',
                'Periodic maintenance: validate the SBP risk-free-rate input and publish pipeline run metadata.',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-sand bg-cream p-4 text-sm leading-7 text-muted">
                  {item}
                </div>
              ))}
            </div>
          </Panel>

          <div className="space-y-4">
            {NEXT_PHASE_STREAMS.map((item) => (
              <Panel key={item.title} className="bg-white p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-terracotta-light text-terracotta">
                    <item.icon size={18} />
                  </div>
                  <h3 className="text-lg font-semibold text-brown">{item.title}</h3>
                </div>
                <p className="mt-4 text-sm leading-7 text-muted">{item.body}</p>
              </Panel>
            ))}
          </div>
        </div>
      </Section>
    </div>
  )
}

function Footer() {
  return (
    <div className="bg-brown px-6 py-12 text-center text-white">
      <p className="text-3xl font-bold text-white" style={{ fontFamily: 'Georgia, serif' }}>گُلَّک</p>
      <p className="mt-2 text-sm text-white/70">Team MarketByte · AWS AI Hackathon · March 2026</p>
      <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/70">
        Gullak provides AI-assisted mutual fund analysis for informational purposes. It does not execute trades, does not provide portfolio allocation advice, and is designed to help investors understand SECP-regulated fund choices more clearly.
      </p>
    </div>
  )
}

export function About({ onTryGullak }) {
  return (
    <div className="h-full overflow-y-auto bg-cream">
      <Hero onTryGullak={onTryGullak} />
      <JudgeMetrics />
      <Journey />
      <Architecture />
      <Pipeline />
      <Differentiators />
      <BeyondMVP />
      <Footer />
    </div>
  )
}
