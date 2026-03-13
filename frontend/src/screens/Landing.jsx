import { Button } from '@/components/ui/button'

export function Landing({ onStart, isLoading }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 bg-cream">
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        {/* Wordmark */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-terracotta tracking-tight">گُلّک</h1>
          <h2 className="text-2xl font-bold text-brown mt-1">Gullak</h2>
        </div>

        {/* Tagline */}
        <p className="text-xl font-semibold text-brown mb-3 leading-snug">
          Your gullak grew up.<br />Your investments should too.
        </p>

        <p className="text-sm text-muted mb-10 leading-relaxed max-w-xs">
          Tell us your financial goal. Three AI agents analyse every mutual fund in Pakistan and find your best options — explained simply, no jargon.
        </p>

        {/* CTA */}
        <Button
          size="lg"
          onClick={onStart}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Starting...' : 'Find My Funds →'}
        </Button>

        {/* Trust signals */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-6">
          <TrustPill>312 Funds Analysed</TrustPill>
          <TrustPill>Real MUFAP Data</TrustPill>
          <TrustPill>SECP-Regulated AMCs</TrustPill>
        </div>

        {/* Disclaimer */}
        <div className="mt-10 border border-sand rounded-xl px-4 py-3 bg-white/60 max-w-xs text-left">
          <p className="text-xs font-semibold text-brown/80 mb-1">Not Financial Advice</p>
          <p className="text-xs text-muted/80 leading-relaxed">
            Gullak provides AI-generated analysis for informational purposes only. This is <strong>not</strong> financial, investment, or legal advice. Past performance is not a guarantee of future results. Always consult a licensed financial advisor before making investment decisions.
          </p>
        </div>
      </div>
    </div>
  )
}

function TrustPill({ children }) {
  return (
    <span className="text-xs text-muted border border-sand rounded-full px-3 py-1 bg-white">
      {children}
    </span>
  )
}
