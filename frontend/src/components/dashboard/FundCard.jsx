import { useState } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { GullakScoreBadge } from './GullakScoreBadge'
import { ChevronDown, ChevronUp, Shield, HelpCircle, Target } from 'lucide-react'
import { sanitizeSelectionReason } from '@/lib/utils'

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

  const horizonLabel = formatHorizon(months)

  return (
    <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-cream/80 px-2.5 py-2">
      <Target size={11} className="text-terracotta shrink-0" />
      <p className="text-xs text-brown leading-snug">
        At your {horizonLabel} horizon: <span className="font-semibold text-terracotta">{formatPKR(fv)}</span> projected
      </p>
    </div>
  )
}

const pct  = (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—'
const num2 = (v) => v != null ? v.toFixed(2) : '—'

export function FundCard({ fund, investorProfile, onFieldTap, onCardTap }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <TooltipProvider>
      <Card className="hover:border-terracotta/30 transition-colors">
      <CardHeader>
        {/* Tappable fund header */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex items-start gap-3 w-full text-left group"
              onClick={() => onCardTap?.({ fund_id: fund.fund_id, fund_name: fund.fund_name })}
            >
              <GullakScoreBadge score={fund.fundlens_score} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  {fund.shariah_flag && (
                    <Badge variant="success">
                      <Shield size={10} className="mr-1" />
                      Shariah
                    </Badge>
                  )}
                  <Badge variant="secondary">{fund.category}</Badge>
                </div>
                <h3 className="text-sm font-bold text-brown leading-snug group-hover:text-terracotta transition-colors">
                  {fund.fund_name}
                </h3>
                <p className="text-xs text-muted mt-0.5">{fund.amc_name}</p>
              </div>
              <HelpCircle size={13} className="text-muted/30 group-hover:text-terracotta/60 transition-colors mt-0.5 shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            Tap to ask Gullak why this fund is here and what tradeoffs it has versus the others.
          </TooltipContent>
        </Tooltip>

        {fund.selection_reason && (
          <p className="text-xs text-muted mt-2 leading-relaxed">
            {sanitizeSelectionReason(fund.selection_reason)}
          </p>
        )}

        <GoalProjection fund={fund} investorProfile={investorProfile} />
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <SmallMetric
            label="1Y Return"    value={pct(fund.return_1y)}    positive={fund.return_1y >= 0}
            tooltipText={`Tap to see what this return says about ${fund.fund_name} and your goal.`}
            onTap={() => onFieldTap?.({ field: 'return_1y',    label: '1-Year Return',    value: pct(fund.return_1y),    fund_id: fund.fund_id, fund_name: fund.fund_name })}
          />
          <SmallMetric
            label="Max Drawdown" value={pct(fund.max_drawdown)} positive={false}
            tooltipText={`Tap to understand the worst historical drop for ${fund.fund_name}.`}
            onTap={() => onFieldTap?.({ field: 'max_drawdown', label: 'Maximum Drawdown', value: pct(fund.max_drawdown), fund_id: fund.fund_id, fund_name: fund.fund_name })}
          />
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 text-xs text-muted hover:text-brown transition-colors py-1"
        >
          {expanded ? <><ChevronUp size={12} />Less</> : <><ChevronDown size={12} />More details</>}
        </button>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-sand space-y-2">
            <SmallDetail label="Expense ratio"    value={fund.expense_ratio != null ? `${fund.expense_ratio}%` : '—'} />
            <SmallDetail label="Sharpe ratio"     value={num2(fund.sharpe_ratio)} />
            <SmallDetail label="3Y Return"        value={pct(fund.return_3y_ann)} />
            <SmallDetail
              label="Upside / Downside"
              value={fund.upside_capture_ratio != null
                ? `${fund.upside_capture_ratio.toFixed(0)}% / ${fund.downside_capture_ratio?.toFixed(0)}%`
                : '—'}
            />
          </div>
        )}
      </CardContent>
      </Card>
    </TooltipProvider>
  )
}

function SmallMetric({ label, value, positive, onTap, tooltipText }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onTap}
          className="bg-cream rounded-lg px-2.5 py-2 text-left w-full hover:bg-sand/70 transition-colors group"
        >
          <div className="flex items-center justify-between mb-0.5">
            <p className="text-xs text-muted group-hover:text-brown/70 transition-colors">{label}</p>
            <HelpCircle size={9} className="text-muted/30 group-hover:text-terracotta/50 transition-colors" />
          </div>
          <p className={`text-xs font-bold ${positive === true ? 'text-green-700' : positive === false ? 'text-red-600' : 'text-brown'}`}>
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

function SmallDetail({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-xs text-brown font-medium">{value}</span>
    </div>
  )
}
