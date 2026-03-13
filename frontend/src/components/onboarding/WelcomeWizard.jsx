import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, PiggyBank, ShieldCheck, Target, X } from 'lucide-react'

const STEPS = [
  {
    key: 'intro',
    eyebrow: 'Welcome to Gullak',
    title: 'This is a guided mutual fund conversation, not a blank chat box.',
    description:
      "You'll answer a few simple questions and Gullak will translate them into a shortlist of Pakistani mutual funds that actually fit your situation.",
    icon: Target,
    leftTitle: 'What to expect',
    leftItems: [
      {
        title: '1. Tell Gullak your goal',
        body: 'Say what you want the money for, when you need it, and how much you can invest each month.',
      },
      {
        title: '2. Gullak maps your comfort with risk',
        body: 'A short-term goal should not be matched with a high-volatility fund unless you explicitly want that tradeoff.',
      },
      {
        title: '3. You receive a report you can interrogate',
        body: 'Tap funds, metrics, and projection scenarios to understand the recommendation instead of just accepting it.',
      },
    ],
    rightTitle: 'Popular goal examples',
    rightChips: [
      'Wedding in 3 years',
      'House down payment',
      'Child education',
      'Emergency fund',
      'Hajj or Umrah',
      'Retirement savings',
    ],
    calloutTitle: 'Good opening message',
    calloutBody:
      '"I want to save for my daughter\'s university in 10 years. I can invest Rs 15,000 a month and I want something balanced, not too aggressive."',
  },
  {
    key: 'inputs',
    eyebrow: 'What you will tell us',
    title: 'Start with a real-life goal.',
    description:
      'The best answers are concrete: a wedding in 3 years, a house down payment, your child\'s education, Hajj, a car, retirement, or a safety buffer.',
    icon: PiggyBank,
    leftTitle: 'What makes an answer useful',
    leftItems: [
      {
        title: '1. Anchor it to a timeline',
        body: 'A goal in 18 months needs a different fund profile than a goal 10 years away.',
      },
      {
        title: '2. Name your monthly contribution',
        body: 'Even a rough amount helps Gullak judge whether the target is realistic and which funds deserve consideration.',
      },
      {
        title: '3. Describe your comfort with swings',
        body: 'If seeing sharp losses would make you stop investing, say that early so the shortlist stays aligned with your behavior.',
      },
    ],
    rightTitle: 'Details people often include',
    rightChips: [
      'Need money in 2 years',
      'Can invest Rs 8,000/mo',
      'Want low drama',
      'Okay with some volatility',
      'Saving for Hajj',
      'Building emergency cash',
    ],
    calloutTitle: 'Weak vs strong prompt',
    calloutBody:
      'Weak: "Recommend a good fund." Strong: "I need a house down payment in 4 years, can invest Rs 20,000 monthly, and want moderate risk."',
  },
  {
    key: 'report',
    eyebrow: 'What you will get back',
    title: 'A ranked report with plain-language explanations.',
    description:
      'Gullak compares returns, drawdowns, fees, and fit-for-goal. If a term is confusing later, the report will let you tap into quick explanations.',
    icon: ShieldCheck,
    leftTitle: 'What the report shows',
    leftItems: [
      {
        title: '1. A ranked shortlist',
        body: 'You will see the strongest fit first, but also credible alternatives with different tradeoffs.',
      },
      {
        title: '2. Plain-language tradeoffs',
        body: 'The report explains why one fund is steadier, cheaper, or more aggressive instead of forcing you to decode raw finance terms.',
      },
      {
        title: '3. Scenario-based projections',
        body: 'Best-case, average-case, and worst-case outcomes stay visible so the recommendation feels realistic rather than overconfident.',
      },
    ],
    rightTitle: 'What you can tap into',
    rightChips: [
      'Sharpe Ratio',
      'Max Drawdown',
      'Expense Ratio',
      'Scenario projection',
      'Why this fund ranked first',
      'Compare tradeoffs',
    ],
    calloutTitle: 'What to ask next',
    calloutBody:
      'Try follow-ups like: "Why is this fund safer?" "What changes if my goal moves from 3 years to 5?" or "Show me the lower-volatility option."',
  },
]

export function WelcomeWizard({ open, onClose }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  if (!open) return null

  const isLastStep = step === STEPS.length - 1
  const currentStep = STEPS[step]
  const StepIcon = currentStep.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-brown/45 px-4 py-4 backdrop-blur-sm md:py-6">
      <div className="relative flex max-h-[90vh] w-full max-w-[min(92vw,48rem)] flex-col overflow-hidden rounded-[28px] border border-sand/70 bg-cream shadow-[0_30px_80px_rgba(44,26,14,0.22)]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full border border-sand/80 bg-white/85 p-2 text-muted transition-colors hover:text-brown"
          aria-label="Close welcome guide"
        >
          <X size={16} />
        </button>

        <div className="border-b border-sand/70 bg-[linear-gradient(135deg,rgba(250,246,241,0.96),rgba(245,230,220,0.92))] px-5 py-5 md:px-7 md:py-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-terracotta text-white shadow-sm">
              <StepIcon size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-terracotta">{currentStep.eyebrow}</p>
              <p className="text-sm text-muted">Step {step + 1} of {STEPS.length}</p>
            </div>
          </div>
          <h2 className="max-w-xl text-2xl font-bold leading-tight text-brown md:text-[2rem]">{currentStep.title}</h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted md:text-[15px]">{currentStep.description}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-7 md:py-6">
          <div className="grid gap-5 md:grid-cols-[1.25fr_0.95fr]">
            <div className="rounded-3xl border border-sand/80 bg-white px-5 py-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">{currentStep.leftTitle}</p>
              <div className="mt-4 space-y-3">
                {currentStep.leftItems.map((item) => (
                  <div key={item.title} className="rounded-2xl bg-cream px-4 py-3">
                    <p className="text-sm font-semibold text-brown">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-terracotta/20 bg-terracotta-light px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-terracotta">{currentStep.rightTitle}</p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {currentStep.rightChips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-terracotta/15 bg-white px-3 py-2 text-xs font-medium text-brown shadow-sm"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <div className="mt-5 rounded-2xl border border-white/80 bg-white/80 px-4 py-4">
                <p className="text-sm font-semibold text-brown">{currentStep.calloutTitle}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{currentStep.calloutBody}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-sand/70 bg-white/85 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-7">
          <div className="flex items-center gap-2">
            {STEPS.map((item, index) => (
              <span
                key={item.key}
                className={`h-2.5 rounded-full transition-all ${index === step ? 'w-8 bg-terracotta' : 'w-2.5 bg-sand'}`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 md:justify-end">
            <button
              onClick={onClose}
              className="text-sm font-medium text-muted transition-colors hover:text-brown"
            >
              Skip for now
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
                className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-terracotta/90"
              >
                {isLastStep ? 'Start chatting' : 'Next'}
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}