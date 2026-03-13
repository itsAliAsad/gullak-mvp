# FundLens — Data Reference

Pipeline inputs, computed outputs, and field-level schema for the Fund Intelligence Dataset.

**As of: 2026-03-13 | Funds: 522 | AMCs: 24 | Shariah: 266 | Conventional: 256**

---

## 1. Data Files Overview

| File | Role | Records | Refresh |
|------|------|---------|---------|
| `fund_directory.csv` | Master fund list — every other file joins here | 522 funds | Monthly |
| `nav_daily_with_ids.csv` | Daily NAV time series for all funds | 301,749 rows | Daily (append) |
| `expense_ratios.csv` | Total Expense Ratio (TER) per fund | 522 funds | Monthly |
| `benchmark_daily.csv` | KSE-100, KMI-30, KSE-30 daily index levels | 3,711 rows | Daily |
| `fund_returns.csv` | MUFAP-published return periods (dividend-adjusted) | 522 funds | Daily |
| `2.5 risk_free_rate.json` | SBP T-bill rate (risk-free rate baseline) | 1 record | Bi-weekly (manual) |
| `fund_features.json` | **Final computed dataset — what the agents query** | 522 funds | Regenerated daily |

---

## 2. Pipeline Input Schemas

### `fund_directory.csv`
Source: MUFAP Fund Directory. The spine of the dataset — all other files join back here.

| Column | Type | Description |
|--------|------|-------------|
| `fund_name` | string | Full official fund name as on MUFAP |
| `fund_id` | string | MUFAP unique integer identifier |
| `amc_name` | string | Asset Management Company name |
| `category` | string | MUFAP category (e.g., Equity, Money Market, Shariah Compliant Equity) |
| `fund_type` | string | Open-End Funds, Voluntary Pension Scheme, Employer Pension Funds, Dedicated Equity Funds |
| `risk_profile` | string | MUFAP classification: Low, Medium, High, Very Low, Low to High, NA |
| `nav` | float | NAV at time of directory scrape (snapshot only — use `nav_daily_with_ids.csv` for time series) |
| `offer_price` | float | Buy price. 0.00 = fund closed to new investment |
| `shariah_flag` | boolean | True if category starts with "Shariah Compliant" or "VPS-Shariah" |

---

### `nav_daily_with_ids.csv`
Source: MUFAP NAV page. One row per fund per trading day. Input for all return and risk calculations.
Date range: **2023-03-13 → 2026-03-13** (3 years, 522 funds, 301,749 rows).

| Column | Type | Description |
|--------|------|-------------|
| `date` | date (YYYY-MM-DD) | Trading date. No entries for weekends or Pakistani public holidays |
| `fund_id` | string | Joins to `fund_directory.csv` |
| `fund_name` | string | Fund name at time of scrape |
| `nav` | float | Net Asset Value per unit — all returns derive from this |
| `offer_price` | float | Buy price (NAV + front-end load). 0 if closed |
| `redemption_price` | float | Sell/redemption price (NAV − back-end load, if any) |
| `front_end_load` | float | Front-end sales load as a percentage |

---

### `expense_ratios.csv`
Source: MUFAP Expense Ratios tab. One row per fund.

| Column | Type | Description |
|--------|------|-------------|
| `fund_name` | string | Joins to `fund_directory.csv` |
| `expense_ratio_pct` | float | Total Expense Ratio as a percentage (e.g., 2.50 = 2.50% annual fee) |

---

### `benchmark_daily.csv`
Source: PSX / OpenDoors. Daily index levels for benchmark comparison.
Date range: **2021-03-15 → 2026-03-12** (KSE100: 1,237 rows | KMI30: 1,237 rows | KSE30: 1,237 rows).

| Column | Type | Description |
|--------|------|-------------|
| `date` | date (YYYY-MM-DD) | Trading date |
| `benchmark_name` | string | `KSE100`, `KMI30`, or `KSE30` |
| `index_level` | float | Closing index level |
| `volume` | float | Trading volume (available but not used in feature computation) |
| `open_candidate` | float | Opening level candidate |

---

### `fund_returns.csv`
Source: MUFAP fund detail pages. MUFAP's own published return figures — dividend-adjusted and annualized per MUFAP methodology. These are used directly in `fund_features.json` rather than being recomputed from NAV to match MUFAP's official numbers.

| Column | Type | Description |
|--------|------|-------------|
| `fund_id` | string | Joins to `fund_directory.csv` |
| `fund_name` | string | Fund name |
| `scraped_at` | string | Timestamp of the scrape |
| `return_ytd` | float | Year-to-date return (decimal) |
| `return_mtd` | float | Month-to-date return |
| `return_1m` | float | Trailing 1-month return |
| `return_3m` | float | Trailing 3-month return |
| `return_6m` | float | Trailing 6-month return |
| `return_9m` | float | Trailing 9-month return |
| `return_1y` | float | Trailing 1-year return |
| `return_2y` | float | Trailing 2-year cumulative return |
| `return_3y` | float | Trailing 3-year cumulative return |

Zero values from MUFAP are treated as null (MUFAP returns 0.0 for unavailable periods, not for genuine zero returns).

---

### `2.5 risk_free_rate.json`
Source: SBP T-Bill auction results (updated manually after each auction).

| Field | Type | Description |
|-------|------|-------------|
| `rate_annual_pct` | float | Annualized T-bill yield (e.g., 10.5001 = 10.50%) |
| `tenor` | string | T-bill tenor used (currently `3M`) |
| `as_of_date` | date | Date of the SBP auction |
| `source` | string | Always "SBP T-Bill Auction" |

**Current value: 10.5001% (3M, as of 2026-03-04)**

---

## 3. Computed Output: `fund_features.json`

Generated by `compute_fund_features.py`. This is the only file the AI agents query at runtime.

### Top-Level Structure

```json
{
  "generated_at_utc": "2026-03-13T...",
  "as_of_date": "2026-03-13",
  "benchmark_policy_version": "v1",
  "input_files": { ... },
  "summary": { ... },
  "funds": [ { ...per-fund record... }, ... ]
}
```

---

### Per-Fund Fields

#### Identity (522/522 funds)

| Field | Type | Description |
|-------|------|-------------|
| `fund_id` | string | MUFAP unique identifier |
| `fund_name` | string | Full official fund name |
| `amc_name` | string | Asset Management Company |
| `category` | string | MUFAP category |
| `fund_type` | string | Fund structure type |
| `risk_profile` | string | MUFAP risk classification |
| `shariah_flag` | boolean | True = Shariah-compliant |
| `as_of_date` | date | Most recent NAV date for this fund |
| `benchmark_name` | string \| null | Assigned benchmark: `KSE100`, `KMI30`, or null (fixed income / money market) |
| `benchmark_policy_known_category` | boolean | False = new MUFAP category not yet in mapping table |

---

#### Return Metrics
Source: `fund_returns.csv` (MUFAP official, dividend-adjusted). All values are decimals (0.22 = 22%). Null = insufficient history.

| Field | Formula | Coverage | Notes |
|-------|---------|----------|-------|
| `return_ytd` | NAV₀ / NAV_Jan1 − 1 | 497/522 | ~5% null (funds with no Jan 1 NAV) |
| `return_mtd` | NAV₀ / NAV_month_start − 1 | 491/522 | |
| `return_1m` | NAV₀ / NAV₋₃₀ − 1 | 479/522 | |
| `return_3m` | NAV₀ / NAV₋₉₀ − 1 | 450/522 | |
| `return_6m` | NAV₀ / NAV₋₁₈₀ − 1 | 415/522 | |
| `return_9m` | NAV₀ / NAV₋₂₇₀ − 1 | 400/522 | |
| `return_1y` | NAV₀ / NAV₋₁y − 1 | 384/522 | |
| `return_2y` | NAV₀ / NAV₋₂y − 1 (cumulative) | 334/522 | |
| `return_3y` | NAV₀ / NAV₋₃y − 1 (cumulative) | 316/522 | |
| `return_3y_ann` | (1 + return_3y)^(1/3) − 1 | 316/522 | Annualized form of `return_3y`. MVP feature per schema. |

---

#### Risk Metrics
Source: Computed from `nav_daily_with_ids.csv`. Trailing 3-year lookback window. Monthly returns resampled from daily NAV.

| Field | Formula | Coverage | Description |
|-------|---------|----------|-------------|
| `volatility_monthly` | stddev(monthly returns) | 438/522 | Monthly return standard deviation. Overall price fluctuation. |
| `downside_deviation` | stddev(negative monthly returns only) | 438/522 | Volatility of losses only — ignores upside swings. |
| `max_drawdown` | max peak-to-trough NAV decline | 519/522 | Worst-case loss. Expressed as negative decimal (−0.30 = −30%). |
| `max_drawdown_recovery_days` | Days from trough back to prior peak | 228/522 | Null = fund has not yet recovered from its worst drawdown. |
| `rolling_return_12m_avg` | Mean of all rolling 12-month returns over 3 years | 398/522 | Average return across overlapping annual windows. |
| `rolling_return_12m_stddev` | Std dev of rolling 12-month returns | 394/522 | Lower = more consistent. Measures return reliability across time. |

---

#### Risk-Adjusted Metrics

| Field | Formula | Coverage | Description |
|-------|---------|----------|-------------|
| `sharpe_ratio` | (return_1y − RFR) / (volatility_monthly × √12) | 374/522 | Return per unit of total risk. Compare within same category only. |
| `sortino_ratio` | (return_1y − RFR) / (downside_deviation × √12) | 325/522 | Like Sharpe but only penalizes downside volatility. |

Risk-free rate used: **10.5001%** (current SBP 3M T-bill rate).

---

#### Benchmark Metrics
Only available for funds assigned a benchmark (equity and balanced categories). 181 funds have a benchmark assigned; 159 have enough overlapping monthly data for beta/capture computation.

| Field | Formula | Coverage | Description |
|-------|---------|----------|-------------|
| `benchmark_return_1y` | Index₀ / Index₋₁y − 1 | 181/522 | 1-year return of the fund's benchmark index |
| `excess_return_1y` | return_1y − benchmark_return_1y | 154/522 | Positive = fund beat the market |
| `beta` | Cov(fund, benchmark) / Var(benchmark) | 159/522 | Sensitivity to benchmark. 1.2 = 20% more volatile than market |
| `alpha` | return_1y − [RFR + beta × (benchmark_return_1y − RFR)] | 154/522 | Excess return from manager skill. Positive = manager adds value |
| `upside_capture_ratio` | (fund return in up months / benchmark return in up months) × 100 | 159/522 | Ideally >100%. How much the fund participates in gains |
| `downside_capture_ratio` | (fund return in down months / benchmark return in down months) × 100 | 159/522 | Ideally <100%. How well the fund protects in declines |

---

#### Cost Metrics

| Field | Type | Coverage | Description |
|-------|------|----------|-------------|
| `expense_ratio` | float (%) | 434/522 | Total Expense Ratio from MUFAP. Annual fee charged by the AMC. |
| `expense_vs_category` | float | 434/522 | Fund TER minus category average TER. Negative = cheaper than peers. |
| `front_end_load` | float (%) | 522/522 | Entry sales load. 0.0 = no-load fund. |
| `risk_free_rate` | float (%) | 522/522 | Current SBP T-bill rate. Same for all funds. Context for cost comparison. |

---

#### Composite Scores (1–10, normalized within category)

Each score is a percentile rank within the fund's category, scaled to 1–10. A score of 10 means top of its peer group; 1 means bottom.

| Score | Inputs | Coverage | Higher = |
|-------|--------|----------|----------|
| `performance_score` | return_1y (45%), return_3y (35%), rolling_return_12m_avg (20%), alpha bonus (+10% if available) | 403/522 | Better returns |
| `risk_score` | volatility_monthly (40%), \|max_drawdown\| (40%), downside_deviation (20%) — all inverted | 519/522 | Lower risk |
| `cost_score` | expense_ratio (70%), front_end_load (30%) — both inverted | 522/522 | Cheaper |
| `consistency_score` | rolling_return_12m_stddev (50% inv), \|max_drawdown\| (20% inv), sharpe_ratio (30%) | 519/522 | More predictable |
| `capture_score` | upside_capture_ratio − downside_capture_ratio | 159/522 | Better asymmetric performance |

**`fundlens_score` (not yet computed):** A weighted combination of all five scores above. Weights shift per investor profile — conservative weights risk/cost/consistency higher; aggressive weights performance/capture higher. To be calculated at query time by Agent 2 based on the investor's profile.

---

## 4. Category Breakdown (522 funds)

| Category | Count | Shariah | Benchmark |
|----------|-------|---------|-----------|
| Income | 49 | No | None (T-bill proxy) |
| Fixed Rate / Return | 49 | No | None |
| Shariah Compliant Income | 43 | Yes | None |
| VPS-Shariah Compliant Money Market | 40 | Yes | None |
| Shariah Compliant Money Market | 35 | Yes | None |
| Money Market | 28 | No | None |
| VPS-Money Market | 27 | No | None |
| Equity | 27 | No | KSE-100 |
| Shariah Compliant Fund of Funds | 25 | Yes | KMI-30 |
| Shariah Compliant Equity | 24 | Yes | KMI-30 |
| Shariah Compliant Fixed Rate / Return | 22 | Yes | None |
| Shariah Compliant Asset Allocation | 19 | Yes | KMI-30 |
| VPS-Shariah Compliant Debt | 17 | Yes | None |
| VPS-Shariah Compliant Equity | 17 | Yes | KMI-30 |
| Asset Allocation | 15 | No | KSE-100 |
| VPS-Debt | 11 | No | None |
| VPS-Equity | 11 | No | KSE-100 |
| Fund of Funds | 8 | No | KSE-100 |
| Capital Protected | 8 | No | None |
| Aggressive Fixed Income | 7 | No | None |
| Exchange Traded Fund | 6 | No | KSE-100 |
| Shariah Compliant Capital Protected | 6 | Yes | None |
| Shariah Compliant Dedicated Equity | 5 | Yes | KMI-30 |
| Shariah Compliant Aggressive Fixed Income | 5 | Yes | None |
| Balanced | 4 | No | KSE-100 |
| *(other — 10 categories, 1–2 funds each)* | 13 | Mixed | Mixed |

---

## 5. Benchmark Mapping

| Fund Category | Benchmark | Metrics Available |
|---------------|-----------|------------------|
| Equity, Asset Allocation, Balanced, Fund of Funds, Index Tracker, ETF, Dedicated Equity | KSE-100 | benchmark_return_1y, excess_return_1y, beta, alpha, capture ratios |
| Shariah Compliant Equity, Shariah Asset Allocation, Shariah Fund of Funds, VPS-Shariah Equity, Shariah ETF, Shariah Dedicated Equity | KMI-30 | benchmark_return_1y, excess_return_1y, beta, alpha, capture ratios |
| Income, Money Market, Fixed Rate/Return, Aggressive Fixed Income, Capital Protected, VPS-Debt, VPS-Money Market | None | Use `risk_free_rate` as comparison baseline |

**Note:** Balanced and Asset Allocation funds should technically use PKRV (Pakistan Rupee Valuation curve) as benchmark. PKRV is not in the current pipeline — KSE-100/KMI-30 is used as a proxy.

---

## 6. Known Gaps (Post-MVP)

| Missing Feature | What's Needed | Impact |
|-----------------|--------------|--------|
| `aum_pkr_millions` | MUFAP AUM scraper | Cannot filter out tiny funds by AUM threshold |
| `aum_flow_3m` | MUFAP AUM history (3 months) | Cannot detect net outflows as a red flag |
| `back_end_load` | Additional MUFAP scrape field | Exit fee not factored into cost_score |
| `concentration_top5` | Fund manager PDF → Textract → Bedrock pipeline | Cannot flag concentrated holdings risk |
| `top_holdings`, `sector_allocation`, `equity_pct` | Same PDF pipeline | No holdings-level monitoring for Agent 4 |
| `fund_manager_name`, `fund_manager_tenure_months` | Fund manager report PDF | Cannot flag manager change events |
| `return_5y_annualized` | MUFAP only provides up to 3Y; need 5Y NAV history | Missing long-horizon return signal |

---

## 7. Regenerating

```bash
python compute_fund_features.py
```

Reads all six input files and overwrites `fund_features.json`. Runs in under 30 seconds.

Optional arguments:
```
--directory-file   fund_directory.csv (default)
--nav-file         nav_daily_with_ids.csv (default; falls back to nav_daily_filtered.csv, then nav_daily.csv)
--expense-file     expense_ratios.csv (default)
--benchmark-file   benchmark_daily.csv (default)
--risk-free-file   "2.5 risk_free_rate.json" (default)
--returns-file     fund_returns.csv (default)
--output           fund_features.json (default)
```
