import { useState, useEffect } from 'react'
import { Calculator } from 'lucide-react'

// SIP future value: PMT × [(1+r)^n - 1] / r × (1+r)
// r = monthly rate, n = number of months
function sipFV(monthlyPmt, annualRate, months) {
  if (!monthlyPmt || !annualRate || !months) return null
  const r = annualRate / 12
  if (r === 0) return monthlyPmt * months
  return monthlyPmt * ((Math.pow(1 + r, months) - 1) / r) * (1 + r)
}

function formatPKR(amount) {
  if (!amount || isNaN(amount)) return '—'
  if (amount >= 10_000_000) return `Rs ${(amount / 10_000_000).toFixed(1)}Cr`
  if (amount >= 100_000)    return `Rs ${(amount / 100_000).toFixed(1)}L`
  return `Rs ${Math.round(amount).toLocaleString('en-PK')}`
}

// Try to extract monthly amount and horizon from the investor_summary string
function parseFromSummary(summary = '') {
  const amtMatch    = summary.match(/(?:PKR|Rs\.?)\s*([\d,]+)/i)
  const yearMatch   = summary.match(/(\d+)-year/i)
  const monthMatch  = summary.match(/(\d+)\s*months?/i)

  const amount  = amtMatch   ? parseInt(amtMatch[1].replace(/,/g, ''))  : null
  const months  = monthMatch ? parseInt(monthMatch[1])
                : yearMatch  ? parseInt(yearMatch[1]) * 12
                : null
  return { amount, months }
}

// Build three scenario rates from available fund data.
// Worst: base × 0.35  — significant underperformance
// Average: base (3y annualised, or 1y fallback)
// Best: base × 1.55  — strong market year
function scenarioRates(fund) {
  const base = fund.return_3y_ann ?? fund.return_1y
  if (base == null) return null
  return {
    worst:   Math.max(0.001, base * 0.35),
    average: base,
    best:    base * 1.55,
  }
}

function ScenarioBar({ label, fv, invested, goalTarget, isBest, colorClass, bgClass }) {
  const gain      = fv - invested
  const hitsGoal  = goalTarget && fv >= goalTarget
  return (
    <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg ${hitsGoal ? 'bg-green-50' : bgClass}`}>
      <div className="flex items-center gap-2 min-w-0">
        <span className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 ${colorClass}`}>{label}</span>
        {hitsGoal && <span className="text-[9px] text-green-700 font-medium">✓ Reaches goal</span>}
      </div>
      <div className="text-right shrink-0 ml-2">
        <p className={`text-xs font-bold ${hitsGoal ? 'text-green-700' : colorClass}`}>{formatPKR(fv)}</p>
        <p className="text-[9px] text-muted">+{formatPKR(gain)}</p>
      </div>
    </div>
  )
}

export function InvestmentCalculator({ shortlist, investorProfile }) {
  const goalTarget = investorProfile?.target_amount_pkr

  const [monthlyAmount, setMonthlyAmount] = useState('')
  const [years, setYears]                 = useState('')
  const [expanded, setExpanded] = useState(false)

  // Hydrate from profile whenever it becomes available or changes (e.g. after reanalysis).
  // useEffect is required because useState initializers only run once at mount — if
  // investorProfile arrives after mount or changes on reanalysis, we need to sync here.
  useEffect(() => {
    const amount = investorProfile?.monthly_amount
    if (amount != null) setMonthlyAmount(amount)
    else {
      // Fallback: try to parse from the investor_summary string
      const parsed = parseFromSummary(shortlist?.investor_summary)
      if (parsed.amount != null) setMonthlyAmount(parsed.amount)
    }
  }, [investorProfile?.monthly_amount])   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const months = investorProfile?.time_horizon_months
    if (months != null) setYears(Math.round(months / 12))
    else {
      const parsed = parseFromSummary(shortlist?.investor_summary)
      if (parsed.months != null) setYears(Math.round(parsed.months / 12))
    }
  }, [investorProfile?.time_horizon_months])  // eslint-disable-line react-hooks/exhaustive-deps

  const funds   = shortlist?.shortlist ?? []
  const months  = Number(years) * 12
  const pmt     = Number(String(monthlyAmount).replace(/,/g, ''))
  const invested = pmt * months

  const results = funds.map(f => {
    const rates = scenarioRates(f)
    if (!rates) return null
    return {
      fund_id:  f.fund_id,
      name:     f.fund_name,
      category: f.category,
      rate:     rates.average,
      scenarios: {
        worst:   sipFV(pmt, rates.worst,   months),
        average: sipFV(pmt, rates.average, months),
        best:    sipFV(pmt, rates.best,    months),
      },
    }
  }).filter(Boolean)

  const bestFV = results.length ? Math.max(...results.map(r => r.scenarios.average)) : null

  return (
    <div className="mx-4 md:mx-6 mb-6 border border-sand rounded-2xl overflow-hidden bg-white">
      {/* Header — always visible */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-cream/60 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2">
          <Calculator size={15} className="text-terracotta" />
          <span className="text-sm font-semibold text-brown">Projected Returns Calculator</span>
        </div>
        <span className="text-xs text-muted">{expanded ? 'Hide' : 'Show'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-sand">
          {/* Inputs */}
          <div className="flex gap-3 mt-3 mb-3">
            <div className="flex-1">
              <label className="text-xs text-muted block mb-1">Monthly Investment (PKR)</label>
              <input
                type="number"
                value={monthlyAmount}
                onChange={e => setMonthlyAmount(e.target.value)}
                placeholder="e.g. 20000"
                className="w-full text-sm border border-sand rounded-lg px-3 py-2 bg-cream focus:outline-none focus:border-terracotta/50 text-brown"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted block mb-1">Investment Period (years)</label>
              <input
                type="number"
                value={years}
                onChange={e => setYears(e.target.value)}
                placeholder="e.g. 13"
                className="w-full text-sm border border-sand rounded-lg px-3 py-2 bg-cream focus:outline-none focus:border-terracotta/50 text-brown"
              />
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-[10px] text-muted/60 mb-3">
            Based on each fund's 3-year annualised return. Scenarios are illustrative — not a guarantee of future results.
            Worst/best cases apply ±65% variation to the average rate.
          </p>

          {/* Results */}
          {pmt > 0 && months > 0 ? (
            <div className="space-y-2">
              {/* Invested amount row */}
              <div className="flex justify-between items-center px-3 py-2 bg-cream rounded-lg">
                <span className="text-xs text-muted">Total invested</span>
                <span className="text-xs font-semibold text-brown">{formatPKR(invested)}</span>
              </div>
              {goalTarget && (
                <div className="flex justify-between items-center px-3 py-2 bg-terracotta/5 border border-terracotta/20 rounded-lg">
                  <span className="text-xs text-muted">Your goal</span>
                  <span className="text-xs font-semibold text-terracotta">{formatPKR(goalTarget)}</span>
                </div>
              )}

              {/* Per-fund projections */}
              {results.map((r) => {
                const isBestAvg   = r.scenarios.average === bestFV
                const avgHitsGoal = goalTarget && r.scenarios.average >= goalTarget
                return (
                  <div
                    key={r.fund_id}
                    className={`rounded-xl border overflow-hidden ${
                      avgHitsGoal ? 'border-green-200' : isBestAvg ? 'border-terracotta/30' : 'border-sand'
                    }`}
                  >
                    {/* Fund header */}
                    <div
                      className={`flex items-center justify-between px-3 py-2.5 ${
                        avgHitsGoal ? 'bg-green-50' : isBestAvg ? 'bg-terracotta/5' : 'bg-cream/40'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-brown truncate">{r.name}</p>
                        <p className="text-[10px] text-muted">{r.category} · {r.rate != null ? `${(r.rate * 100).toFixed(1)}% p.a. avg` : ''}</p>
                      </div>
                      {avgHitsGoal && (
                        <span className="text-[9px] text-green-700 font-medium shrink-0 ml-2">Reaches goal</span>
                      )}
                    </div>

                    {/* Scenarios — always visible */}
                    <div className="px-3 pb-2.5 pt-1.5 space-y-1.5 border-t border-sand/60 bg-white">
                      <ScenarioBar
                        label="Best case"
                        fv={r.scenarios.best}
                        invested={invested}
                        goalTarget={goalTarget}
                        colorClass="text-emerald-600"
                        bgClass="bg-emerald-50/60"
                      />
                      <ScenarioBar
                        label="Average case"
                        fv={r.scenarios.average}
                        invested={invested}
                        goalTarget={goalTarget}
                        colorClass={isBestAvg ? 'text-terracotta' : 'text-brown'}
                        bgClass={isBestAvg ? 'bg-terracotta/5' : 'bg-cream/60'}
                      />
                      <ScenarioBar
                        label="Worst case"
                        fv={r.scenarios.worst}
                        invested={invested}
                        goalTarget={goalTarget}
                        colorClass="text-amber-600"
                        bgClass="bg-amber-50/40"
                      />
                      <p className="text-[9px] text-muted/60 pt-0.5">
                        Worst assumes 35% of avg rate · Best assumes 155%
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-muted text-center py-4">
              Enter your monthly amount and years above to see projections.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
