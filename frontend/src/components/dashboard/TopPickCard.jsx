import { useState } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { GullakScoreBadge } from './GullakScoreBadge'
import { ChevronDown, ChevronUp, Shield, HelpCircle, Target } from 'lucide-react'
import { sanitizeSelectionReason, humanizeField } from '@/lib/utils'

function sipFV(monthlyPmt, annualRate, months) {
  if (!monthlyPmt || !annualRate || !months) return null
  const r = annualRate / 12
  if (r === 0) return monthlyPmt * months
  return monthlyPmt * ((Math.pow(1 + r, months) - 1) / r) * (1 + r)
}

function formatPKR(amount) {
  if (amount == null || Number.isNaN(amount)) return '—'
  const absoluteAmount = Math.abs(amount)
  const prefix = amount < 0 ? '-Rs ' : 'Rs '
  if (absoluteAmount >= 10_000_000) return `${prefix}${(absoluteAmount / 10_000_000).toFixed(1)}Cr`
  if (absoluteAmount >= 100_000)    return `${prefix}${(absoluteAmount / 100_000).toFixed(1)}L`
  return `${prefix}${Math.round(absoluteAmount).toLocaleString('en-PK')}`
}

function formatHorizon(months) {
  if (!months) return null
  if (months % 12 === 0) {
    const years = months / 12
    return `${years} year${years === 1 ? '' : 's'}`
  }
  const years = months / 12
  return `${years.toFixed(1)} years`
}

function GoalProjection({ fund, investorProfile }) {
  const monthly = investorProfile?.monthly_amount
  const months  = investorProfile?.time_horizon_months
  const rate    = fund.return_3y_ann ?? fund.return_1y
  if (!monthly || !months || !rate) return null

  const fv = sipFV(monthly, rate, months)
  if (!fv) return null

  const invested = monthly * months
  const gain = fv - invested
  const horizonLabel = formatHorizon(months)

  return (
    <div className="mt-3 rounded-xl border border-terracotta/20 bg-white/75 px-3 py-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <Target size={13} className="text-terracotta shrink-0" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-terracotta">
          Projection at your {horizonLabel} horizon
        </p>
      </div>
      <div className="grid gap-2 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-muted">Invested</span>
          <span className="font-semibold text-brown">{formatPKR(invested)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-muted">Projected value</span>
          <span className="font-bold text-terracotta">{formatPKR(fv)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-sand/80 pt-2">
          <span className="text-muted">Projected gain</span>
          <span className={`font-semibold ${gain >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {gain >= 0 ? '+' : ''}{formatPKR(gain)}
          </span>
        </div>
      </div>
    </div>
  )
}

const pct  = (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—'
const num2 = (v) => v != null ? v.toFixed(2) : '—'

export function TopPickCard({ fund, investorProfile, onFieldTap, onCardTap }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <TooltipProvider>
      <div className="px-4">
        <Card className="relative overflow-hidden border-2 border-terracotta shadow-[0_20px_55px_-28px_rgba(196,98,45,0.8)] ring-4 ring-terracotta/15">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-2 bg-gradient-to-b from-terracotta via-[#a54820] to-terracotta" />
        <CardHeader className="relative bg-gradient-to-br from-white via-[#fff9f4] to-[#f6e7da] pl-5">
          {/* Fund identity — tappable header */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex items-start gap-3 w-full text-left group"
                onClick={() => onCardTap?.({ fund_id: fund.fund_id, fund_name: fund.fund_name })}
              >
                <GullakScoreBadge score={fund.fundlens_score} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="rounded-full border border-terracotta/30 bg-white/85 px-2 py-0.5 text-[11px] font-semibold text-terracotta uppercase tracking-[0.24em] shadow-sm">
                      Top Pick
                    </span>
                    {fund.shariah_flag && (
                      <Badge variant="success">
                        <Shield size={10} className="mr-1" />
                        Shariah
                      </Badge>
                    )}
                    <Badge variant="secondary">{fund.category}</Badge>
                  </div>
                  <h2 className="text-base font-bold text-brown leading-snug group-hover:text-terracotta transition-colors">
                    {fund.fund_name}
                  </h2>
                  <p className="text-xs text-muted mt-0.5">{fund.amc_name}</p>
                </div>
                <HelpCircle size={14} className="text-muted/40 group-hover:text-terracotta/60 transition-colors mt-1 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              Tap to ask Gullak why this fund made your shortlist and how it fits your goal.
            </TooltipContent>
          </Tooltip>

          {fund.selection_reason && (
            <p className="text-sm text-brown/80 mt-3 leading-relaxed italic border-l-4 border-terracotta/35 pl-3">
              "{sanitizeSelectionReason(fund.selection_reason)}"
            </p>
          )}

          <GoalProjection fund={fund} investorProfile={investorProfile} />
        </CardHeader>

        <CardContent className="relative bg-white pl-5">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Metric label="1Y Return"     value={pct(fund.return_1y)}   positive={fund.return_1y >= 0}
              tooltipText={`Tap to see what this return says about ${fund.fund_name} and your goal.`}
              onTap={() => onFieldTap?.({ field: 'return_1y',     label: '1-Year Return',   value: pct(fund.return_1y),   fund_id: fund.fund_id, fund_name: fund.fund_name })} />
            <Metric label="Max Drawdown"  value={pct(fund.max_drawdown)} positive={false}
              tooltipText={`Tap to understand the worst historical drop for ${fund.fund_name}.`}
              onTap={() => onFieldTap?.({ field: 'max_drawdown',  label: 'Maximum Drawdown', value: pct(fund.max_drawdown), fund_id: fund.fund_id, fund_name: fund.fund_name })} />
            <Metric label="Sharpe Ratio"  value={num2(fund.sharpe_ratio)}
              tooltipText={`Tap to see whether ${fund.fund_name} is being rewarded enough for its risk.`}
              onTap={() => onFieldTap?.({ field: 'sharpe_ratio',  label: 'Sharpe Ratio',    value: num2(fund.sharpe_ratio), fund_id: fund.fund_id, fund_name: fund.fund_name })} />
            <Metric label="Expense Ratio" value={fund.expense_ratio != null ? `${fund.expense_ratio}%` : '—'}
              tooltipText={`Tap to see how this fee affects ${fund.fund_name} over time.`}
              onTap={() => onFieldTap?.({ field: 'expense_ratio', label: 'Expense Ratio',   value: `${fund.expense_ratio}%`, fund_id: fund.fund_id, fund_name: fund.fund_name })} />
          </div>

          {fund.upside_capture_ratio != null && (
            <div className="bg-cream rounded-xl p-3 mb-4">
              <p className="text-xs text-muted mb-1.5 font-medium">Market capture</p>
              <p className="text-sm text-brown">
                Captures{' '}
                <span className="font-bold text-terracotta">{fund.upside_capture_ratio.toFixed(0)}%</span>{' '}
                of gains, only{' '}
                <span className="font-bold text-green-700">{fund.downside_capture_ratio?.toFixed(0)}%</span>{' '}
                of losses
              </p>
            </div>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-1 text-xs text-muted hover:text-brown transition-colors py-1"
          >
            {expanded ? <><ChevronUp size={14} />Hide details</> : <><ChevronDown size={14} />See full details</>}
          </button>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-sand space-y-3">
              <DetailRow label="3Y Return (ann.)"      value={pct(fund.return_3y_ann)} />
              <DetailRow label="Sortino Ratio"          value={num2(fund.sortino_ratio)} />
              <DetailRow label="Alpha"                  value={num2(fund.alpha)} />
              <DetailRow label="Beta"                   value={num2(fund.beta)} />
              <DetailRow label="Front-end load"         value={fund.front_end_load != null ? `${fund.front_end_load}%` : '—'} />
              <DetailRow
                label="Expense vs category"
                value={fund.expense_vs_category != null
                  ? `${fund.expense_vs_category > 0 ? '+' : ''}${fund.expense_vs_category.toFixed(2)}%`
                  : '—'}
              />
              {fund.scores_missing?.length > 0 && (
                <p className="text-xs text-muted/70 pt-1">
                  Note: {fund.scores_missing.map(humanizeField).join(', ')} not available for this fund.
                </p>
              )}
            </div>
          )}
        </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}

function Metric({ label, value, positive, onTap, tooltipText }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onTap}
          className="bg-cream rounded-lg px-3 py-2 text-left w-full hover:bg-sand/70 transition-colors group relative"
        >
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-xs text-muted group-hover:text-brown/70 transition-colors">{label}</p>
            <HelpCircle size={10} className="text-muted/30 group-hover:text-terracotta/50 transition-colors" />
          </div>
          <p className={`text-sm font-bold ${positive === true ? 'text-green-700' : positive === false ? 'text-red-600' : 'text-brown'}`}>
            {value}
          </p>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-xs text-brown font-medium">{value}</span>
    </div>
  )
}
