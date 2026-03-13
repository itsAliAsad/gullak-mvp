# PRD: FundLens Scraping Pipeline

## 1. Document Status

- Owner: Data Platform / FundLens
- Date: 2026-03-13
- Status: Draft v1
- Primary output: `fund_features.json`
- Supporting outputs: `fund_directory.csv`, `nav_daily.csv` or `nav_daily_with_ids.csv`, `expense_ratios.csv`, `fund_returns.csv`, `benchmark_daily.csv`, `fund_benchmark_mapping.csv`

## 2. Product Summary

The FundLens scraping pipeline is a deterministic data ingestion and feature computation system that collects mutual fund data from MUFAP, benchmark history from PSX, and the risk-free rate from SBP, then produces a normalized fund intelligence dataset for downstream AI agents and analytics workflows.

The product goal is not just to scrape web pages. It is to maintain a trustworthy, refreshable, and explainable fund dataset that can answer investor questions, compare peer funds, and support ranking logic without manual spreadsheet work.

## 3. Problem Statement

Pakistan mutual fund data is fragmented across multiple pages and formats:

- fund identity and classification live in the MUFAP directory
- daily NAV history lives in MUFAP industry statistics
- official trailing returns live behind a fund detail API
- expense ratios live in a separate MUFAP tab
- benchmark history lives on PSX DPS endpoints
- the risk-free rate is sourced separately from SBP auction results

Without a pipeline, these datasets cannot be joined reliably, refreshed consistently, or consumed by agents in a single canonical format. Manual aggregation is slow, error-prone, and not suitable for daily fund intelligence use cases.

## 4. Product Vision

Create a single source of truth for Pakistani mutual fund analytics that is:

- complete enough to cover the full MUFAP fund universe
- trustworthy enough to drive user-facing fund comparisons
- deterministic enough that repeated runs produce the same results from the same inputs
- transparent enough that each output field can be traced back to a source file and calculation rule

## 5. Users and Stakeholders

### Primary users

- AI agents querying `fund_features.json`
- internal analysts validating fund coverage and category mapping
- product workflows that need peer comparison, benchmark context, and score-based ranking

### Stakeholders

- product owner for FundLens
- data engineering / scraping maintainer
- analytics consumers using fund intelligence outputs

## 6. Goals

### Business goals

- reduce manual effort required to maintain mutual fund intelligence data
- provide daily-refreshable structured data for investor-facing recommendations and analysis
- standardize benchmark mapping and scoring logic across all funds

### Product goals

- ingest the full current MUFAP fund directory
- maintain at least three years of daily NAV history where available
- preserve MUFAP official return figures rather than recomputing those returns from NAV
- compute standardized risk, cost, benchmark, and composite metrics per fund
- emit a single machine-readable JSON artifact for downstream query systems

### Success metrics

- `fund_directory.csv` covers the full live MUFAP directory on each run
- `fund_features.json` is regenerated successfully on scheduled refreshes
- benchmark-aware metrics are populated only for policy-mapped equity-bearing categories
- output summary clearly reports skipped funds, unknown categories, and metric coverage

## 7. Non-Goals

- building a user-facing dashboard in this repo
- intraday pricing or real-time benchmark ingestion
- automatic retrieval of the SBP risk-free rate from a live source in v1
- benchmark assignment beyond the current deterministic category policy
- reconciliation against AMC factsheets or dividend histories outside the current MUFAP/PSX/SBP inputs

## 8. Current Product Scope

The current pipeline already consists of six functional stages:

1. Scrape the MUFAP fund directory into a master fund registry.
2. Scrape daily NAV history from MUFAP and validate rows against the fund registry.
3. Scrape expense ratios from MUFAP and validate rows against the fund registry.
4. Scrape official trailing return figures from the MUFAP fund detail API.
5. Scrape benchmark history from PSX DPS.
6. Compute fund-level features and scores into `fund_features.json`.

An optional helper stage resolves category-to-benchmark assignments into `fund_benchmark_mapping.csv` for auditability.

## 9. Data Sources

### MUFAP Fund Directory

- Endpoint: `https://www.mufap.com.pk/FundProfile/FundDirectory`
- Role: master identity and classification dataset
- Expected output: `fund_directory.csv`
- Key join field: `fund_id`

### MUFAP Industry Statistics NAV view

- Endpoint: `https://www.mufap.com.pk/Industry/IndustryStatDaily?tab=3`
- Role: daily NAV, offer price, redemption price, and front-end load history
- Expected output: `nav_daily.csv` or `nav_daily_with_ids.csv`
- Key join field: `fund_id` when available

### MUFAP Expense Ratios view

- Endpoint: `https://www.mufap.com.pk/Industry/IndustryStatDaily?tab=5`
- Role: total expense ratio snapshot
- Expected output: `expense_ratios.csv`

### MUFAP Fund Detail API

- Endpoint: `https://www.mufap.com.pk/AMC/GetFundDetailbyAMCByDate`
- Role: official MTD, YTD, and trailing return figures
- Expected output: `fund_returns.csv`
- Important behavior: zero values from the API are treated as missing for unavailable periods

### PSX DPS benchmark endpoints

- Endpoints: `KSE100`, `KSE30`, `KMI30`
- Role: benchmark time series for benchmark-aware fund metrics
- Expected output: `benchmark_daily.csv`
- Important behavior: exact duplicate rows may appear and must be deduplicated safely

### SBP risk-free rate

- Source file: `2.5 risk_free_rate.json`
- Role: input to Sharpe ratio, Sortino ratio, and alpha calculations
- Current mode: manually maintained input file

## 10. Core User Stories

- As an AI agent, I need a single JSON file with all relevant fund features so I can answer user questions without joining multiple raw files.
- As a data maintainer, I need deterministic scrapers with validation checks so broken upstream HTML or API changes are caught early.
- As a product owner, I need benchmark mapping to be explicit and policy-driven so benchmark metrics are explainable.
- As an analyst, I need metric coverage and skipped-record counts so I can judge output quality after each run.

## 11. Functional Requirements

### FR1. Master fund registry

The system must scrape the MUFAP fund directory and write `fund_directory.csv` containing at minimum:

- `fund_name`
- `fund_id`
- `amc_name`
- `category`
- `fund_type`
- `risk_profile`
- `nav`
- `offer_price`
- `shariah_flag`

Requirements:

- each record must have a valid `fund_id`
- duplicate `fund_id` values must raise an error
- the output must be fully rewritten on each successful run

### FR2. NAV history ingestion

The system must fetch MUFAP NAV history across a configurable date range and write a normalized daily CSV.

Requirements:

- default range must cover the last three years
- data must be fetched in calendar chunks to reduce request size
- rows with blank validity dates must be skipped and counted
- page fund names must match the master directory for the same `fund_id`
- conflicting duplicate `(date, fund_id)` records must raise an error
- non-trading weekdays with unchanged snapshots must be filtered out using trading-date inference

### FR3. Expense ratio ingestion

The system must scrape MUFAP expense ratios and export one record per fund.

Requirements:

- rows must validate against `fund_directory.csv` by `fund_id`
- the exported metric must default to TER YTD in v1
- TER MTD must remain available through a CLI switch
- conflicting duplicate fund records must raise an error

### FR4. Official returns ingestion

The system must call the MUFAP fund detail API and store official return figures for each fund.

Requirements:

- the scraper must accept a month anchor in `YYYY-MM-01` format
- the scraper must support targeted testing by fund ID
- the scraper must support resume mode to skip already-written fund IDs
- request pacing must be configurable to avoid hammering the upstream API
- parse or request failures for a fund must be logged without aborting the entire run

### FR5. Benchmark history ingestion

The system must fetch PSX benchmark history and normalize it into a single CSV.

Requirements:

- support `KSE100`, `KSE30`, and `KMI30`
- deduplicate exact repeated rows by `(date, benchmark_name)`
- raise an error on conflicting duplicates
- reject non-positive index values and negative volumes
- preserve the fourth DPS field as `open_candidate` until PSX provides formal field labeling

### FR6. Deterministic benchmark policy

The system must resolve benchmarks from category strings using a deterministic policy file.

Requirements:

- conventional equity-bearing categories map to `KSE100`
- shariah equity-bearing categories map to `KMI30`
- fixed income, money market, and related non-equity categories map to `null`
- unknown categories must not crash the pipeline; they must be surfaced as warnings and written as policy gaps
- `KSE30` must be ingested but not used for fund feature computation in v1

### FR7. Feature computation

The system must generate `fund_features.json` as the canonical downstream artifact.

Requirements:

- output must include run metadata, input file references, summary counters, and per-fund records
- per-fund records must include identity, return, risk, risk-adjusted, benchmark, cost, and composite score fields
- NAV-based risk metrics must use a trailing three-year lookback window where available
- MUFAP official returns must be used directly for return fields instead of recomputing those values from NAV
- benchmark-dependent metrics must be null when no benchmark applies or overlapping history is insufficient
- category-relative scores must be normalized within category on a 1 to 10 scale

### FR8. Coverage and quality reporting

The final output must expose enough metadata to evaluate quality after each run.

Requirements:

- summary must report total records output
- summary must report funds skipped due to no NAV history
- summary must report ambiguous fund-name count when fund-ID-based NAV data is unavailable
- summary must report number of funds with MUFAP returns, composite scores, and capture scores
- summary must report unknown category count and sample values

## 12. Non-Functional Requirements

### Reliability

- all HTTP scraping stages must use retries for transient failures
- upstream response validation must fail loudly on structural changes
- feature generation must be deterministic for the same input files

### Performance

- daily refresh should complete in operationally acceptable time on a single workstation
- the returns scraper may be the slowest stage because it is fund-by-fund and rate-limited
- chunked NAV fetching must prevent overly large requests

### Maintainability

- each stage must remain executable as a standalone CLI script
- benchmark mapping logic must live in a dedicated policy module and documentation file
- output schemas must remain stable enough for downstream agent consumption

### Explainability

- each computed metric must be attributable to a source file and formula
- benchmark assignment must be deterministic and inspectable
- summary fields must explain data gaps instead of silently masking them

## 13. Output Contract

### Canonical output

`fund_features.json` must contain:

- `generated_at_utc`
- `as_of_date`
- `benchmark_policy_version`
- `input_files`
- `summary`
- `funds`

### Required per-fund groups

- identity fields
- MUFAP return fields
- NAV-derived risk fields
- Sharpe and Sortino ratios
- benchmark-relative metrics where applicable
- cost metrics
- composite scores

### Null-handling rules

- missing or unavailable return periods must be stored as `null`
- benchmark metrics must be `null` for `null` benchmark categories or insufficient overlap
- drawdown recovery must be `null` if the fund has not recovered from the worst drawdown

## 14. Pipeline Orchestration

### Required run order

1. `scrape_fund_directory.py`
2. `scrape_nav_daily.py`
3. `scrape_expense_ratios.py`
4. `scrape_fund_returns.py`
5. `scrape_benchmark_daily.py`
6. `resolve_benchmark_names.py` optional but recommended for audit output
7. `compute_fund_features.py`

### Example commands

```powershell
.venv\Scripts\python.exe scrape_fund_directory.py
.venv\Scripts\python.exe scrape_nav_daily.py
.venv\Scripts\python.exe scrape_expense_ratios.py
.venv\Scripts\python.exe scrape_fund_returns.py --resume
.venv\Scripts\python.exe scrape_benchmark_daily.py
.venv\Scripts\python.exe resolve_benchmark_names.py
.venv\Scripts\python.exe compute_fund_features.py
```

### Scheduling target

- Daily: directory, NAV, returns, benchmark, feature computation
- Monthly or on demand: expense ratios, unless business needs require daily snapshots
- Bi-weekly manual update: risk-free rate file after the latest SBP auction

## 15. Data Quality Rules

- `fund_directory.csv` is the source of identity truth
- upstream rows that fail schema expectations must raise explicit errors
- joins that cannot be validated by `fund_id` must not guess silently
- ambiguous fund names must be skipped when ID-safe joins are not possible
- exact duplicates may be deduplicated only when values match perfectly
- conflicting duplicates must stop the relevant stage

## 16. Known Limitations

- the risk-free rate is still manually updated rather than scraped automatically
- the returns scraper depends on a non-public MUFAP API shape that may change
- the PSX DPS fourth benchmark field is preserved conservatively as `open_candidate` and is not yet formally confirmed
- benchmark policy is category-level, not fund prospectus-level
- some benchmark-aware metrics require long enough overlapping monthly histories and will remain null for newer funds

## 17. Risks

### Upstream HTML or API drift

MUFAP may change table structure, hidden fields, or API payload keys.

Mitigation:

- strict structural validation
- isolated stage failures
- summary reporting and maintainable parser modules

### Identity mismatches across pages

If a MUFAP page exposes a `fund_id` and name combination that diverges from the directory, joins may become unsafe.

Mitigation:

- validate page name against directory name for each `fund_id`
- fail rather than merge mismatched identities

### Data freshness gaps

Expense ratios and risk-free rate update less frequently than NAV and returns.

Mitigation:

- document refresh cadence per source
- keep input file references in the final output

## 18. Acceptance Criteria

- A full run produces `fund_features.json` with run metadata, summary metadata, and per-fund records.
- The pipeline fails loudly on structural source breakage, conflicting duplicates, or invalid benchmark rows.
- Funds with known benchmarks receive benchmark-aware metrics only when sufficient history exists.
- Funds in non-equity categories receive `null` benchmark metrics by policy.
- The output summary exposes skipped counts and category-policy gaps.
- The run is reproducible from the documented CLI sequence and current input files.

## 19. Future Enhancements

- automate SBP risk-free-rate retrieval and validation
- add a top-level orchestrator script or scheduled task runner for one-command refreshes
- persist scrape metadata such as run duration, HTTP failure counts, and source freshness timestamps
- add schema tests and snapshot tests for critical parsers
- extend benchmark policy beyond category-level heuristics where better fund-level benchmarks are available
- compute investor-profile-weighted `fundlens_score` at generation time or in a downstream query layer

## 20. Open Questions

- Should expense ratios be captured daily as a historical snapshot, or is latest-only sufficient for product use cases?
- Should the pipeline persist raw HTML and JSON source snapshots for audit and parser-regression testing?
- Should `KSE30` remain ingested-only, or should it be promoted for specific categories in a future policy version?
- Should the returns stage retry or queue failed fund IDs into a separate recovery file rather than only logging them?

## 21. Recommended Definition of Done for v1

The v1 product is complete when:

- all six ingestion and computation stages run successfully from the documented CLI sequence
- the output JSON is stable enough for downstream agents to rely on
- benchmark mapping policy is documented and versioned
- data quality gaps are reported explicitly rather than hidden
- the team can refresh the dataset without manual CSV editing except for the current risk-free-rate input
