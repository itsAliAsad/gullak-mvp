import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, BarChart3, CircleHelp, MousePointerClick, Target, X } from 'lucide-react'

const GLOSSARY = [
  {
    key: 'sharpe',
    label: 'Sharpe Ratio',
    simple: 'How much return a fund delivered for each unit of risk it took.',
    why: 'Higher is generally better. Two funds with similar returns are not equal if one got there with far bigger swings.',
    where: 'You will see this inside the top pick and detailed cards.',
  },
  {
    key: 'drawdown',
    label: 'Max Drawdown',
    simple: 'The worst peak-to-trough fall the fund experienced over the measured period.',
    why: 'This is the pain test. It tells you how ugly the ride can get before the fund recovers.',
    where: 'Tap the metric tile when you want the report to explain the tradeoff in plain language.',
  },
  {
    key: 'expense',
    label: 'Expense Ratio',
    simple: 'The annual cost charged by the fund manager to run the fund.',
    why: 'Fees quietly compound against you. A fund needs to earn enough to justify what it charges.',
    where: 'Shown in the top pick and expanded fund details.',
  },
  {
    key: 'capture',
    label: 'Upside / Downside Capture',
    simple: 'How much of the market’s gains and losses the fund tends to participate in.',
    why: 'It helps separate aggressive funds from funds that protect better when markets turn.',
    where: 'Surfaced in the top recommendation summary and fund details.',
  },
  {
    key: 'projection',
    label: 'Scenario Projection',
    simple: 'A simple best-case, average-case, and worst-case estimate based on historical fund returns.',
    why: 'It frames uncertainty. You should never read one projected number as a promise.',
    where: 'The projections section now shows all three scenarios for every shortlisted fund.',
  },
]

const STEPS = [
  {
    key: 'report',
    eyebrow: 'Your report is ready',
    title: 'Read this report like a decision tool, not a marketing brochure.',
    description:
      'The shortlist is ranked for your goal. Use it to compare fit, risk, and cost before you ever think about where to invest.',
    icon: Target,
  },
  {
    key: 'glossary',
    eyebrow: 'Confusing terms decoded',
    title: 'Tap any jargon below to see what it means in plain language.',
    description:
      'These are the terms people usually gloss over. This guide makes them readable before you dive into the cards.',
    icon: CircleHelp,
  },
  {
    key: 'interact',
    eyebrow: 'How to explore',
    title: 'The report is interactive on purpose.',
    description:
      'Tap metric tiles, tap narration cards, inspect each fund’s scenarios, and use follow-up chat when you want a recommendation challenged.',
    icon: MousePointerClick,
  },
]

export function ReportOnboardingWizard({ open, onClose }) {
  const [step, setStep] = useState(0)
  const [activeTerm, setActiveTerm] = useState(GLOSSARY[0])

  useEffect(() => {
    if (open) {
      setStep(0)
      setActiveTerm(GLOSSARY[0])
    }
  }, [open])

  if (!open) return null

  const isLastStep = step === STEPS.length - 1
  const currentStep = STEPS[step]
  const StepIcon = currentStep.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-brown/45 px-4 py-4 backdrop-blur-sm md:py-6">
      <div className="relative flex max-h-[90vh] w-full max-w-[min(92vw,48rem)] flex-col overflow-hidden rounded-[30px] border border-sand/70 bg-white shadow-[0_35px_90px_rgba(44,26,14,0.24)]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full border border-sand/80 bg-white/90 p-2 text-muted transition-colors hover:text-brown"
          aria-label="Close report guide"
        >
          <X size={16} />
        </button>

        <div className="border-b border-sand/70 bg-[linear-gradient(140deg,rgba(245,230,220,0.92),rgba(250,246,241,0.96))] px-5 py-5 md:px-7 md:py-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brown text-white shadow-sm">
              <StepIcon size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-terracotta">{currentStep.eyebrow}</p>
              <p className="text-sm text-muted">Step {step + 1} of {STEPS.length}</p>
            </div>
          </div>
          <h2 className="max-w-2xl text-2xl font-bold leading-tight text-brown md:text-[2rem]">{currentStep.title}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted md:text-[15px]">{currentStep.description}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-7 md:py-6">
          {step === 0 && (
            <div className="grid gap-4 md:grid-cols-3">
              <FeatureCard
                icon={Target}
                title="Top pick"
                body="The top card is Gullak's strongest fit for your goal after weighing growth, volatility, and cost together."
              />
              <FeatureCard
                icon={BarChart3}
                title="Also consider"
                body="These are not filler options. They are credible alternatives with different tradeoffs worth comparing."
              />
              <FeatureCard
                icon={CircleHelp}
                title="Explainability"
                body="If a number feels abstract, tap it. The report is built to justify itself, not hide behind finance jargon."
              />
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-5 md:grid-cols-[1.15fr_0.85fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">Clickable glossary</p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {GLOSSARY.map((term) => (
                    <button
                      key={term.key}
                      onClick={() => setActiveTerm(term)}
                      className={`rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                        activeTerm.key === term.key
                          ? 'border-terracotta bg-terracotta text-white'
                          : 'border-sand bg-cream text-brown hover:border-terracotta/40'
                      }`}
                    >
                      {term.label}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted">
                  These mimic the kind of concepts you can inspect throughout the report. Start here, then tap the real metrics in the cards when you want fund-specific explanations.
                </p>
              </div>

              <div className="rounded-3xl border border-terracotta/20 bg-terracotta-light px-5 py-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">{activeTerm.label}</p>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Plain meaning</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-brown">{activeTerm.simple}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Why you should care</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-brown">{activeTerm.why}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Where to look</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-brown">{activeTerm.where}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4 md:grid-cols-3">
              <FeatureCard
                icon={CircleHelp}
                title="Tap the metric tiles"
                body="1Y Return, Max Drawdown, Sharpe Ratio, and Expense Ratio are all there to be questioned. Use the tap targets."
              />
              <FeatureCard
                icon={BarChart3}
                title="Read all scenarios"
                body="The projections area shows best case, average case, and worst case for each shortlisted fund so uncertainty stays visible."
              />
              <FeatureCard
                icon={MousePointerClick}
                title="Use follow-up chat"
                body="Ask why one fund beat another, what a tradeoff means, or whether the shortlist should change if your goal changes."
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 border-t border-sand/70 bg-cream/70 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-7">
          <div className="flex items-center gap-2">
            {STEPS.map((item, index) => (
              <span
                key={item.key}
                className={`h-2.5 rounded-full transition-all ${index === step ? 'w-8 bg-brown' : 'w-2.5 bg-sand'}`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 md:justify-end">
            <button
              onClick={onClose}
              className="text-sm font-medium text-muted transition-colors hover:text-brown"
            >
              Close guide
            </button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  onClick={() => setStep((current) => current - 1)}
                  className="inline-flex items-center gap-2 rounded-full border border-sand bg-white px-4 py-2 text-sm font-medium text-brown transition-colors hover:border-terracotta/40"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
              )}
              <button
                onClick={isLastStep ? onClose : () => setStep((current) => current + 1)}
                className="inline-flex items-center gap-2 rounded-full bg-brown px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brown/92"
              >
                {isLastStep ? 'Start exploring' : 'Next'}
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, body }) {
  return (
    <div className="rounded-3xl border border-sand bg-white px-5 py-5 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cream text-terracotta">
        <Icon size={20} />
      </div>
      <h3 className="mt-4 text-base font-semibold text-brown">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  )
}