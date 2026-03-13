import { Check } from 'lucide-react'

const STEPS = [
  { id: 'chat',      label: 'Understanding You'  },
  { id: 'analyzing', label: 'Analysing Funds'    },
  { id: 'dashboard', label: 'Your Results'       },
]

// A step is "done" if the flow has passed it.
function stepStatus(stepId, screen) {
  const order = ['chat', 'analyzing', 'dashboard']
  const stepIdx   = order.indexOf(stepId)
  const screenIdx = order.indexOf(screen)
  if (screenIdx > stepIdx) return 'done'
  if (screenIdx === stepIdx) return 'active'
  return 'upcoming'
}

function StepItem({ label, status }) {
  const isDone    = status === 'done'
  const isActive  = status === 'active'

  return (
    <div className={`flex items-center gap-3 transition-all duration-300 ${isActive ? 'text-brown' : isDone ? 'text-muted' : 'text-muted/35'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300 ${
        isDone   ? 'bg-green-600'  :
        isActive ? 'bg-terracotta' :
                   'bg-sand/60'
      }`}>
        {isDone
          ? <Check size={12} className="text-white" strokeWidth={2.5} />
          : <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-muted'}`}>
              {STEPS.findIndex(s => s.label === label) + 1}
            </span>
        }
      </div>
      <span className={`text-xs font-medium tracking-wide ${isActive ? 'font-semibold' : ''}`}>{label}</span>
    </div>
  )
}

function TrustItem({ children }) {
  return (
    <div className="flex items-center gap-1.5">
      <Check size={11} className="text-terracotta shrink-0" strokeWidth={2.5} />
      <span className="text-xs text-muted">{children}</span>
    </div>
  )
}

export function Sidebar({ screen }) {
  return (
    <div className="hidden md:flex w-[220px] shrink-0 flex-col justify-between py-8 px-6 border-r border-sand bg-cream h-full">
      <div>
        <p
          className="text-brown mb-3 leading-snug font-semibold"
          style={{ fontFamily: 'Georgia, serif', fontSize: '17px' }}
        >
          Your gullak grew up.<br />Your investments should too.
        </p>

        <p className="text-xs text-muted leading-relaxed mb-7">
          Tell us your goal. Three AI agents analyse every mutual fund in Pakistan and find your best options — no jargon.
        </p>

        {/* Progress steps */}
        <div className="space-y-3 mb-7">
          <p className="text-[10px] text-muted uppercase tracking-widest font-semibold mb-1">Progress</p>
          {STEPS.map(step => (
            <StepItem key={step.id} label={step.label} status={stepStatus(step.id, screen)} />
          ))}
        </div>

        {/* Trust signals */}
        <div className="space-y-2">
          <TrustItem>312 Funds Analysed</TrustItem>
          <TrustItem>Real MUFAP Data</TrustItem>
          <TrustItem>SECP-Regulated AMCs</TrustItem>
        </div>
      </div>

      <p className="text-[10px] text-muted/55 leading-relaxed">
        AI-generated analysis for informational purposes only. Not financial advice. Verify with a licensed advisor before investing.
      </p>
    </div>
  )
}
