# FundLens Benchmark Mapping Policy (v1)

This document defines the category-to-benchmark assignment rule used by FundLens for benchmark-aware features such as `benchmark_return_1y`, `excess_return_1y`, `beta`, `alpha`, `upside_capture`, and `downside_capture`.

## Scope

- Use `KSE100` for conventional equity-bearing fund categories.
- Use `KMI30` for Shariah-compliant equity-bearing fund categories.
- Use `null` for non-equity categories in v1.
- Do not use `KSE30` for FundLens feature computation in v1.

## Rationale

- A benchmark should represent the investable risk of the category, not merely be available in the dataset.
- Applying an equity benchmark to money market, income, fixed-rate, or debt funds would produce misleading excess return and risk metrics.
- The rule must be deterministic from `fund_directory.csv` so every run produces the same benchmark assignment.

## Category Mapping

### `KSE100`

- `Asset Allocation`
- `Balanced`
- `Capital Protected`
- `Dedicated Equity`
- `Equity`
- `Exchange Traded Fund`
- `Fund of Funds`
- `Index Tracker`
- `VPS-Equity`

### `KMI30`

- `Shariah Compliant Asset Allocation`
- `Shariah Compliant Balanced`
- `Shariah Compliant Capital Protected`
- `Shariah Compliant Dedicated Equity`
- `Shariah Compliant Equity`
- `Shariah Compliant Exchange Traded Fund`
- `Shariah Compliant Fund of Funds`
- `Shariah Compliant Index Tracker`
- `VPS-Shariah Compliant Equity`

### `null`

- `Aggressive Fixed Income`
- `Capital Protected - Income`
- `Fixed Rate / Return`
- `Income`
- `Money Market`
- `Shariah Compliant Aggressive Fixed Income`
- `Shariah Compliant Commodities`
- `Shariah Compliant Fixed Rate / Return`
- `Shariah Compliant Fund of Funds - CPPI`
- `Shariah Compliant Income`
- `Shariah Compliant Money Market`
- `VPS-Commodities / Gold`
- `VPS-Debt`
- `VPS-Money Market`
- `VPS-Shariah Compliant Commodities / Gold`
- `VPS-Shariah Compliant Debt`
- `VPS-Shariah Compliant Money Market`

## Operational Rules

- If a category maps to `null`, all benchmark-dependent features must be written as `null`.
- If a category is unknown to the policy, treat the benchmark as `null` and surface the category as a validation warning.
- Benchmark returns must use the latest benchmark observation on or before the fund feature date and on or before the lookback date.
- Fund-level features are only valid when the underlying fund identity is unambiguous. In the current scraper outputs, duplicate `fund_name` values prevent safe fund-level joins for some pension sub-funds.

## Known Limitation

`nav_daily.csv` currently does not carry `fund_id`, so duplicate `fund_name` values cannot be resolved reliably into distinct feature rows. The initial feature generator skips those ambiguous fund names instead of guessing.