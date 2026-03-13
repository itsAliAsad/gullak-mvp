import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatPKR(amount) {
  if (amount >= 10_000_000) return `Rs ${(amount / 10_000_000).toFixed(1)}Cr`
  if (amount >= 100_000) return `Rs ${(amount / 100_000).toFixed(1)}L`
  return `Rs ${Number(amount).toLocaleString('en-PK')}`
}

export function formatReturn(value) {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${Number(value).toFixed(1)}%`
}

// Maps internal field names → human-readable labels
const FIELD_LABELS = {
  return_1y:               '1-Year Return',
  return_3y_ann:           '3-Year Return (annualised)',
  return_ytd:              'Year-to-Date Return',
  sharpe_ratio:            'Sharpe Ratio',
  sortino_ratio:           'Sortino Ratio',
  max_drawdown:            'Maximum Drawdown',
  volatility_monthly:      'Monthly Volatility',
  expense_ratio:           'Expense Ratio',
  alpha:                   'Alpha',
  beta:                    'Beta',
  upside_capture_ratio:    'Upside Capture Ratio',
  downside_capture_ratio:  'Downside Capture Ratio',
  fundlens_score:          'Gullak Score',
  performance_score:       'Performance Score',
  risk_score:              'Risk Score',
  cost_score:              'Cost Score',
  consistency_score:       'Consistency Score',
  capture_score:           'Capture Score',
  front_end_load:          'Front-End Load',
  expense_vs_category:     'Expense vs Category Average',
}

export function humanizeField(field) {
  return FIELD_LABELS[field] ?? field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// Strips raw internal field names from Agent 2's selection_reason text.
// e.g. "fundlens_score (8.95)" → "Gullak Score (8.95)"
export function sanitizeSelectionReason(text) {
  if (!text) return text
  return Object.entries(FIELD_LABELS).reduce(
    (t, [key, label]) => t.replaceAll(key, label),
    text
  )
}
