import { Button } from '@/components/ui/button'
import { formatPKR } from '@/lib/utils'
import { CheckCircle } from 'lucide-react'

const RISK_LABELS = {
  conservative: 'Conservative — safety over returns',
  moderate: 'Moderate — can handle some ups and downs',
  aggressive: 'Aggressive — maximum long-term growth',
}

export function ProfileConfirmationCard({ profile, content, onConfirm }) {
  return (
    <div className="rounded-2xl border border-terracotta/25 overflow-hidden shadow-sm">
      {/* Header bar */}
      <div className="bg-terracotta px-4 py-3 flex items-center gap-2">
        <CheckCircle size={15} className="text-white shrink-0" />
        <span className="text-sm font-semibold text-white">Profile Summary</span>
      </div>

      {/* Agent's summary sentence */}
      <div className="bg-terracotta-light px-4 py-3 border-b border-terracotta/15">
        <p className="text-sm text-brown leading-relaxed">{content}</p>
      </div>

      {/* Profile rows */}
      <div className="bg-white px-4 py-3 space-y-2.5">
        {profile.goal && (
          <ProfileRow label="Goal" value={profile.goal} />
        )}
        {profile.monthly_amount && (
          <ProfileRow label="Monthly investment" value={formatPKR(profile.monthly_amount)} />
        )}
        {profile.horizon_years && (
          <ProfileRow label="Time horizon" value={`${profile.horizon_years} years`} />
        )}
        {profile.risk_tolerance && (
          <ProfileRow label="Risk appetite" value={RISK_LABELS[profile.risk_tolerance] || profile.risk_tolerance} />
        )}
        {profile.shariah !== undefined && (
          <ProfileRow label="Shariah-compliant" value={profile.shariah ? 'Yes — halal funds only' : 'No preference'} />
        )}
      </div>

      {/* CTA */}
      <div className="bg-white px-4 pb-4 pt-1 space-y-2">
        <Button className="w-full" onClick={onConfirm}>
          Find My Funds →
        </Button>
        <p className="text-xs text-center text-muted">
          Not quite right? Just tell me what to change.
        </p>
      </div>
    </div>
  )
}

function ProfileRow({ label, value }) {
  return (
    <div className="flex justify-between items-start gap-4 border-b border-sand/60 pb-2.5 last:border-0 last:pb-0">
      <span className="text-xs text-muted shrink-0">{label}</span>
      <span className="text-xs text-brown text-right font-medium">{value}</span>
    </div>
  )
}
