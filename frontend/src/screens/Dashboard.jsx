import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, CircleHelp, RefreshCw } from 'lucide-react'
import { RecommendationHero } from '@/components/dashboard/RecommendationHero'
import { TopPickCard } from '@/components/dashboard/TopPickCard'
import { FundCard } from '@/components/dashboard/FundCard'
import { FollowUpChat } from '@/components/dashboard/FollowUpChat'
import { InvestmentCalculator } from '@/components/dashboard/InvestmentCalculator'
import { ReportOnboardingWizard } from '@/components/onboarding/ReportOnboardingWizard'

const REPORT_WIZARD_SEEN_PREFIX = 'marketbyte.reportWizardSeen.'
const REANALYSIS_TOAST_ID = 'marketbyte.reanalysis-progress'

export function Dashboard({ data, sessionId, onReanalysis, onReset }) {
  const [autoMessage, setAutoMessage]         = useState(null)
  const [cardContext, setCardContext]         = useState(null)
  const [fieldContext, setFieldContext]       = useState(null)
  const [hasFollowUps, setHasFollowUps]       = useState(false)
  const [showReportWizard, setShowReportWizard] = useState(false)
  const followUpRef = useRef(null)

  const hasSeenReportWizard = (currentSessionId) => {
    if (!currentSessionId || typeof window === 'undefined') return false
    return window.sessionStorage.getItem(`${REPORT_WIZARD_SEEN_PREFIX}${currentSessionId}`) === 'true'
  }

  const markReportWizardSeen = (currentSessionId) => {
    if (!currentSessionId || typeof window === 'undefined') return
    window.sessionStorage.setItem(`${REPORT_WIZARD_SEEN_PREFIX}${currentSessionId}`, 'true')
  }

  // Show success toast whenever a reanalysis completes
  useEffect(() => {
    if (data?.reanalyzed) {
      toast.dismiss(REANALYSIS_TOAST_ID)
      toast.success('Analysis complete', {
        description: 'Your report has been refreshed with your updated preferences.',
        duration: 3000,
      })
    }
  }, [data])

  useEffect(() => () => {
    toast.dismiss(REANALYSIS_TOAST_ID)
  }, [])

  useEffect(() => {
    if (!data || !sessionId || hasSeenReportWizard(sessionId)) return

    setShowReportWizard(true)
    markReportWizardSeen(sessionId)
  }, [data, sessionId])

  if (!data) return null

  const { reply, narration, shortlist, investor_profile: investorProfile } = data
  const funds    = shortlist?.shortlist ?? []
  const topFund  = funds[0]
  const otherFunds = funds.slice(1)

  // Metric tile tapped → build a natural-language question and auto-send
  const handleFieldTap = (fieldCtx) => {
    setCardContext(null)
    setFieldContext(fieldCtx)
    const msg = `What does the ${fieldCtx.label} of ${fieldCtx.value} mean for ${fieldCtx.fund_name}, and how does it affect my goal?`
    setAutoMessage(msg + '|' + Date.now()) // append timestamp to force re-trigger on repeat taps
    followUpRef.current?.scrollIntoView()
  }

  // Fund card header tapped → ask about that specific fund
  const handleCardTap = (ctx) => {
    setCardContext(ctx)
    setFieldContext(null)
    const msg = `Tell me more about ${ctx.fund_name} — why is it in my shortlist and what should I know about it?`
    setAutoMessage(msg + '|' + Date.now())
    followUpRef.current?.scrollIntoView()
  }

  // Narration card tapped → ask Gullak to elaborate on that section
  const handleNarrationTap = (item) => {
    setCardContext(null)
    setFieldContext(null)
    const label = item.anchor.replace(/_/g, ' ')
    const msg = `Can you elaborate on the ${label} section? I want to understand this better in the context of my goal.`
    setAutoMessage(msg + '|' + Date.now())
    followUpRef.current?.scrollIntoView()
  }

  const handleFollowUpResponse = (response) => {
    if (response.reanalyzed && response.shortlist) onReanalysis?.(response)
    if (cardContext) setCardContext(null)
    if (fieldContext) setFieldContext(null)
  }

  const handleReanalysisStart = () => {
    toast.loading('Regenerating report', {
      id: REANALYSIS_TOAST_ID,
      description: 'Regenerating report with the new custom fields',
      duration: Infinity,
    })
  }

  const handleReanalysisError = () => {
    toast.dismiss(REANALYSIS_TOAST_ID)
    toast.error('Report regeneration failed', {
      description: 'Please try rerunning the analysis again.',
    })
  }

  return (
    <div className="h-full flex flex-col bg-cream">
      <ReportOnboardingWizard open={showReportWizard} onClose={() => setShowReportWizard(false)} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-sand bg-white/80 backdrop-blur-sm shrink-0">
        <button onClick={onReset} className="text-muted hover:text-brown transition-colors flex items-center gap-1.5 text-sm">
          <ArrowLeft size={16} />
          <span>Start over</span>
        </button>
        <h1 className="text-sm font-semibold text-brown">Your Recommendations</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReportWizard(true)}
            className="text-muted hover:text-brown transition-colors"
            aria-label="Open report guide"
          >
            <CircleHelp size={16} />
          </button>
          <button onClick={onReset} className="text-muted hover:text-brown transition-colors" aria-label="Start over">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Desktop two-column: narration left, top card right */}
        <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] md:items-start md:gap-6 md:px-6 md:pt-4">
          <div className="md:order-1 min-w-0">
            <RecommendationHero
              reply={reply}
              narration={narration}
              onNarrationTap={handleNarrationTap}
            />
          </div>
          {topFund && (
            <div className="md:order-2 md:pt-6 md:justify-self-end md:w-full md:max-w-[420px]">
              <p className="px-4 md:px-0 text-xs text-muted uppercase tracking-wide font-semibold mb-2">Top Pick</p>
              <div className="md:px-0">
                <TopPickCard
                  fund={topFund}
                  investorProfile={investorProfile}
                  onFieldTap={handleFieldTap}
                  onCardTap={handleCardTap}
                />
              </div>
            </div>
          )}
        </div>

        {/* Divider — only on mobile (desktop grid already has visual separation) */}
        <div className="mx-4 md:mx-6 border-t border-sand my-4 md:hidden" />

        {/* Also Consider */}
        {otherFunds.length > 0 && (
          <div className="mb-4 md:px-6">
            <p className="px-4 md:px-0 text-xs text-muted uppercase tracking-wide font-semibold mb-2">Also Consider</p>
            <div className="px-4 md:px-0 grid md:grid-cols-2 gap-3">
              {otherFunds.map(fund => (
                <FundCard
                  key={fund.fund_id}
                  fund={fund}
                  investorProfile={investorProfile}
                  onFieldTap={handleFieldTap}
                  onCardTap={handleCardTap}
                />
              ))}
            </div>
          </div>
        )}

        {/* Projected returns calculator */}
        <InvestmentCalculator shortlist={shortlist} investorProfile={investorProfile} />

        {/* Disclaimer */}
        <div className="mx-4 md:mx-6 mb-4 border border-sand rounded-xl px-4 py-3 bg-white/60">
          <p className="text-xs font-semibold text-brown/70 mb-0.5">Not Financial Advice</p>
          <p className="text-[11px] text-muted/70 leading-relaxed">
            Gullak's recommendations are AI-generated analysis for informational purposes only. This is <strong>not</strong> financial, investment, or legal advice. Past performance does not guarantee future results. Always consult a licensed financial advisor before investing.
          </p>
        </div>

        {/* Scroll-to-chat nudge */}
        {!hasFollowUps && (
          <div className="flex justify-center pb-4">
            <button
              onClick={() => followUpRef.current?.scrollIntoView()}
              className="flex items-center gap-1.5 text-xs text-terracotta/80 hover:text-terracotta border border-terracotta/20 rounded-full px-4 py-1.5 bg-white shadow-sm transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-terracotta animate-pulse" />
              Ask Gullak a question
            </button>
          </div>
        )}

        <div className="h-4" />
      </div>

      {/* Sticky follow-up chat */}
      <div className="shrink-0">
        <FollowUpChat
          ref={followUpRef}
          sessionId={sessionId}
          autoMessage={autoMessage}
          cardContext={cardContext}
          fieldContext={fieldContext}
          onResponse={handleFollowUpResponse}
          onFirstFollowUp={() => setHasFollowUps(true)}
          onReanalysisStart={handleReanalysisStart}
          onReanalysisError={handleReanalysisError}
        />
      </div>
    </div>
  )
}
