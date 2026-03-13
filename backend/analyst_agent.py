import json
import os
import math
import statistics
from typing import Optional, List, Literal, Callable
from dataclasses import dataclass, field

from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from progress_narrator import narrate_progress

# ---------------------------------------------------------------------------
# 1. DATA LOADING  (module-level — runs once at Lambda cold start)
# ---------------------------------------------------------------------------

_DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fund_features.json')

with open(_DATA_PATH) as _f:
    _raw = json.load(_f)

# Full list for iteration-based filtering / ranking
FUNDS_LIST: List[dict] = _raw['funds']

# Dict-keyed index for O(1) get_fund lookups
FUNDS_INDEX: dict[str, dict] = {f['fund_id']: f for f in FUNDS_LIST}


# ---------------------------------------------------------------------------
# 2. CONSTANTS
# ---------------------------------------------------------------------------

RISK_FREE_RATE = 0.104  # Pakistan T-bill rate — hardcoded baseline for all fund comparisons

INVESTABLE_FUND_TYPES = [
    "Open-End Funds",
    "Dedicated Equity Funds",
    "Exchange Traded Fund (ETF)",
]

HORIZON_CATEGORY_MAP = {
    "long": {
        "conventional": [
            "Equity", "Asset Allocation", "Fund of Funds", "Balanced",
            "Dedicated Equity", "Exchange Traded Fund", "Index Tracker",
        ],
        "shariah": [
            "Shariah Compliant Equity", "Shariah Compliant Asset Allocation",
            "Shariah Compliant Fund of Funds", "Shariah Compliant Balanced",
            "Shariah Compliant Dedicated Equity", "Shariah Compliant Index Tracker",
            "Shariah Compliant Exchange Traded Fund",
        ],
    },
    "medium": {
        "conventional": [
            "Asset Allocation", "Balanced", "Income",
            "Aggressive Fixed Income", "Fund of Funds",
        ],
        "shariah": [
            "Shariah Compliant Asset Allocation", "Shariah Compliant Balanced",
            "Shariah Compliant Income", "Shariah Compliant Aggressive Fixed Income",
            "Shariah Compliant Fund of Funds",
        ],
    },
    "short": {
        "conventional": ["Money Market", "Income", "Fixed Rate / Return"],
        "shariah": [
            "Shariah Compliant Money Market", "Shariah Compliant Income",
            "Shariah Compliant Fixed Rate / Return",
        ],
    },
}

# Full grid covers every risk × horizon combination.
# Conservative (low) uses the same weights regardless of horizon —
# capital protection always dominates for risk-averse investors.
WEIGHT_PRESETS = {
    ("low",    "short"):  {"performance_score": 0.15, "risk_score": 0.35, "cost_score": 0.20, "consistency_score": 0.20, "capture_score": 0.10},
    ("low",    "medium"): {"performance_score": 0.15, "risk_score": 0.35, "cost_score": 0.20, "consistency_score": 0.20, "capture_score": 0.10},
    ("low",    "long"):   {"performance_score": 0.15, "risk_score": 0.35, "cost_score": 0.20, "consistency_score": 0.20, "capture_score": 0.10},
    ("medium", "short"):  {"performance_score": 0.20, "risk_score": 0.30, "cost_score": 0.20, "consistency_score": 0.20, "capture_score": 0.10},
    ("medium", "medium"): {"performance_score": 0.25, "risk_score": 0.20, "cost_score": 0.20, "consistency_score": 0.20, "capture_score": 0.15},
    ("medium", "long"):   {"performance_score": 0.25, "risk_score": 0.20, "cost_score": 0.20, "consistency_score": 0.20, "capture_score": 0.15},
    ("high",   "short"):  {"performance_score": 0.25, "risk_score": 0.20, "cost_score": 0.20, "consistency_score": 0.20, "capture_score": 0.15},
    ("high",   "medium"): {"performance_score": 0.30, "risk_score": 0.15, "cost_score": 0.15, "consistency_score": 0.15, "capture_score": 0.25},
    ("high",   "long"):   {"performance_score": 0.35, "risk_score": 0.10, "cost_score": 0.15, "consistency_score": 0.15, "capture_score": 0.25},
}

RankMetric = Literal[
    "performance_score", "risk_score", "cost_score",
    "consistency_score", "capture_score",
    "return_1y", "return_3y", "return_3y_ann", "return_ytd",
    "sharpe_ratio", "sortino_ratio",
    "excess_return_1y", "alpha",
    "expense_ratio", "max_drawdown", "volatility_monthly",
]

# Metrics where lower is better — used in compare_funds highlight logic
LOWER_IS_BETTER = {
    "expense_ratio", "max_drawdown", "volatility_monthly",
    "downside_capture_ratio", "expense_vs_category",
}


# ---------------------------------------------------------------------------
# 3. PYDANTIC MODELS
# ---------------------------------------------------------------------------

class FundShortlistItem(BaseModel):
    rank:                     int
    fund_id:                  str
    fund_name:                str
    amc_name:                 str
    category:                 str
    shariah_flag:             bool
    fundlens_score:           Optional[float] = None
    scores_used:              List[str]        = Field(default_factory=list)
    scores_missing:           List[str]        = Field(default_factory=list)
    # Returns (all decimals — 0.62 = 62%)
    return_ytd:               Optional[float] = None
    return_1y:                Optional[float] = None
    return_3y_ann:            Optional[float] = None
    # Risk metrics
    sharpe_ratio:             Optional[float] = None
    sortino_ratio:            Optional[float] = None
    volatility_monthly:       Optional[float] = None
    max_drawdown:             Optional[float] = None
    max_drawdown_recovery_days: Optional[int] = None
    beta:                     Optional[float] = None
    # Cost
    expense_ratio:            Optional[float] = None
    expense_vs_category:      Optional[float] = None
    front_end_load:           Optional[float] = None
    # Benchmark-relative
    excess_return_1y:         Optional[float] = None
    alpha:                    Optional[float] = None
    upside_capture_ratio:     Optional[float] = None
    downside_capture_ratio:   Optional[float] = None
    # Composite scores (1–10)
    performance_score:        Optional[float] = None
    risk_score:               Optional[float] = None
    cost_score:               Optional[float] = None
    consistency_score:        Optional[float] = None
    capture_score:            Optional[float] = None
    # Rolling return consistency
    rolling_return_12m_avg:   Optional[float] = None
    rolling_return_12m_stddev: Optional[float] = None
    # Why this fund was selected
    selection_reason:         str


class AnalystOutput(BaseModel):
    investor_summary:      str   = Field(description="1-2 sentence restatement of the investor's profile and goal")
    filters_applied:       dict  = Field(description="Filter parameters used to narrow the fund universe")
    universe_after_filter: int   = Field(description="Number of funds remaining after all filters")
    scoring_weights:       dict  = Field(description="Weight preset used to compute the Gullak Score (stored under the internal key fundlens_score)")
    shortlist: List[FundShortlistItem] = Field(
        description="Ranked list of 3–5 recommended funds",
        min_length=1,
        max_length=5,
    )
    category_stats:  dict  = Field(description="Aggregate statistics for the primary fund category")
    risk_free_rate:  float = Field(default=RISK_FREE_RATE, description="Pakistan T-bill rate used as baseline (hardcoded 10.4%)")


# ---------------------------------------------------------------------------
# 4. DEPENDENCIES
# ---------------------------------------------------------------------------

@dataclass
class AnalystDeps:
    investor_profile: dict
    scoring_weights:  dict
    filtered_ids:     List[str] = field(default_factory=list)
    progress_callback: Optional[Callable[[str, str, str, str, Optional[str], Optional[str]], None]] = None


def _emit_progress(
    ctx: RunContext[AnalystDeps],
    status: str = "running",
    stage: str = "analysis",
    tool: Optional[str] = None,
    context: Optional[dict] = None,
) -> None:
    callback = ctx.deps.progress_callback
    if callback:
        progress_context = {
            "risk_tolerance": ctx.deps.investor_profile.get("risk_tolerance"),
            "time_horizon": ctx.deps.investor_profile.get("time_horizon"),
            "goal_summary": ctx.deps.investor_profile.get("goal_summary"),
            **(context or {}),
        }
        narration = narrate_progress("Analyst", stage, tool, status, progress_context)
        callback("Analyst", narration["message"], status, stage, tool, narration["detail"])


# ---------------------------------------------------------------------------
# 5. HELPERS
# ---------------------------------------------------------------------------

def get_weight_preset(risk_tolerance: str, time_horizon: str) -> dict:
    key = (risk_tolerance.lower(), time_horizon.lower())
    return WEIGHT_PRESETS.get(key, WEIGHT_PRESETS[("medium", "medium")])


def compute_fundlens_score(fund: dict, weights: dict) -> dict:
    """
    Weighted average of composite scores. Normalises for missing scores
    so a fund is never penalised for null capture_score data.
    """
    score, total_weight = 0.0, 0.0
    used, missing = [], []
    for name, weight in weights.items():
        value = fund.get(name)
        if value is not None and not (isinstance(value, float) and math.isnan(value)):
            score        += value * weight
            total_weight += weight
            used.append(name)
        else:
            missing.append(name)
    return {
        "fundlens_score": round(score / total_weight, 2) if total_weight > 0 else None,
        "scores_used":    used,
        "scores_missing": missing,
    }


def _clean(val):
    """Return None for NaN/missing values so JSON serialises cleanly."""
    if val is None:
        return None
    if isinstance(val, float) and math.isnan(val):
        return None
    return val


def _percentile(sorted_data: list, p: float) -> float:
    """Linear interpolation percentile on a pre-sorted list."""
    n = len(sorted_data)
    if n == 0:
        return 0.0
    idx   = (n - 1) * p / 100
    lower = int(idx)
    upper = min(lower + 1, n - 1)
    frac  = idx - lower
    return sorted_data[lower] + frac * (sorted_data[upper] - sorted_data[lower])


def _field_stats(values: list) -> dict:
    """Mean / median / min / max / p25 / p75 for a list of floats."""
    clean = sorted(v for v in values if v is not None and not (isinstance(v, float) and math.isnan(v)))
    if not clean:
        return {}
    return {
        "mean":   round(statistics.mean(clean),   6),
        "median": round(statistics.median(clean), 6),
        "min":    round(clean[0],                 6),
        "max":    round(clean[-1],                6),
        "p25":    round(_percentile(clean, 25),   6),
        "p75":    round(_percentile(clean, 75),   6),
    }


# ---------------------------------------------------------------------------
# 6. AGENT
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are Gullak Agent 2 — a fund analyst AI that selects the best Pakistani mutual
funds for an investor based on their profile. You have access to a pre-computed
dataset of 522 Pakistani mutual funds with performance metrics, risk metrics,
cost data, and composite scores.

BRANDING RULE:
- Never say "FundLens" in any user-facing text such as investor_summary or selection_reason.
- The internal field name is fundlens_score, but when referring to it in natural language,
  always call it "Gullak Score".

YOUR ROLE:
- Receive a translated investor profile from the orchestrator
- Use your tools to filter, rank, and compare funds
- Produce a ranked shortlist of 3–5 funds with full data for Agent 3

ANALYTICAL PRINCIPLES:
1. Always filter first, then rank. Never rank the entire universe.
2. Shariah preference is a hard filter, never a soft preference.
3. Category is determined SOLELY by time horizon — the investor never specifies a fund type:
   Short (<2 years): Money Market, Income, Fixed Rate/Return
   Medium (2–5 years): Asset Allocation, Balanced, Income, Aggressive Fixed Income, Fund of Funds
   Long (5+ years): Equity, Asset Allocation, Fund of Funds
4. For Shariah investors, use the Shariah-compliant equivalent of each category.
5. Risk tolerance maps to scoring weights, not category filtering.
6. Never recommend a fund where return_1y is null.
7. Prefer funds with expense_vs_category < 0 (cheaper than peers) when scores are close.
8. If fewer than 3 funds survive filtering, widen one step (short→medium categories) and retry.
9. Always call get_category_stats for the primary category before returning the shortlist.
10. Diversify AMCs — avoid recommending 3+ funds from the same AMC.

GOAL-BASED SCENARIO:
If investor_profile contains target_amount_pkr (a specific savings target):
- Calculate the required annual return to reach the target via monthly SIP:
  Use SIP formula: FV = PMT × [(1+r)^n - 1] / r × (1+r), solve for r given FV=target, PMT=monthly_amount, n=time_horizon_months.
- Prioritise funds whose return_3y_ann (or return_1y) is closest to or exceeds the required rate.
- In each fund's selection_reason, include a projection: e.g. "Based on 3Y returns, this fund would grow Rs X/month to approximately Rs Y over Z years — reaching your Rs T goal."
- Return exactly 5 funds (use max_length=5 and aim for 5 shortlist items) to give the user a full comparison.

NULL HANDLING:
- capture_score is null for ~70% of funds. compute_fundlens_score normalises across
  available scores — a fund is never penalised for missing capture data.
- Rank only on non-null values for the chosen metric.
- Prefer composite scores over raw metrics — they have better dataset coverage.
- If you mention fundlens_score in reasoning or selection_reason, call it "Gullak Score".

DECIMAL CONVENTION (critical):
- All returns and rates are stored as decimals. return_1y 0.62 = 62%.
  The T-bill baseline is 10.4% (0.104). Do NOT convert. Agent 3 handles display.

T-BILL BASELINE:
- The Pakistan T-bill rate is hardcoded at 10.4% (0.104). Always use this as the
  risk-free baseline for Sharpe ratio context and fund comparisons in selection_reason.
  Example: "This fund returned 15.2% — 4.8% above the 10.4% T-bill baseline."

NEGATIVE SHARPE RATIOS:
- In the current high-rate environment many Money Market and Income funds have negative
  Sharpe ratios because returns fall below the 10.4% T-bill rate. This is correct
  and does not mean the fund is poor. For these categories rank by risk_score and
  cost_score, not sharpe_ratio.

TYPICAL TOOL SEQUENCE:
1. filter_funds        → narrow the universe to eligible funds
2. rank_funds ×2       → top 10 by performance_score, cross-reference with sharpe_ratio
3. get_fund ×3–5       → inspect each shortlist candidate in full detail
4. compare_funds       → verify the final set is well-differentiated
5. get_category_stats  → peer context for Agent 3
6. Return AnalystOutput\
"""

agent: Agent[AnalystDeps, AnalystOutput] = Agent(
    'bedrock:us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    deps_type=AnalystDeps,
    output_type=AnalystOutput,
    system_prompt=_SYSTEM_PROMPT,
)


# ---------------------------------------------------------------------------
# 7. TOOLS
# ---------------------------------------------------------------------------

@agent.tool
def filter_funds(
    ctx:                    RunContext[AnalystDeps],
    category:               Optional[List[str]] = None,
    shariah_flag:           Optional[bool]      = None,
    fund_type:              Optional[List[str]] = None,
    exclude_null_return_1y: bool                = True,
    min_performance_score:  Optional[float]     = None,
) -> str:
    """
    Filter the fund universe by hard criteria. Always call this first.
    Stores matched fund_ids in ctx.deps.filtered_ids for subsequent rank_funds calls.

    category: list of MUFAP category names. Pass null to include all categories.
    shariah_flag: true = Shariah-compliant only, false = conventional only, null = both.
    fund_type: defaults to investable types (Open-End, Dedicated Equity, ETF).
               Pass null to accept the default.
    exclude_null_return_1y: recommended true. Auto-relaxes with a warning if fewer
                            than 3 funds survive (common in Fixed Rate/Return).
    min_performance_score: optional lower bound on performance_score (1–10).
    """
    effective_types = fund_type if fund_type else INVESTABLE_FUND_TYPES

    category_count = len(category) if category else 0
    _emit_progress(
        ctx,
        stage="filtering",
        tool="filter_funds",
        context={
            "category_count": category_count or "all",
            "shariah_flag": shariah_flag,
            "exclude_null_return_1y": exclude_null_return_1y,
            "min_performance_score": min_performance_score,
        },
    )

    filtered = [
        f for f in FUNDS_LIST
        if f.get("fund_type") in effective_types
        and (category is None or f.get("category") in category)
        and (shariah_flag is None or f.get("shariah_flag") == shariah_flag)
        and (min_performance_score is None
             or (f.get("performance_score") is not None
                 and f["performance_score"] >= min_performance_score))
    ]

    data_warning = None
    if exclude_null_return_1y:
        with_1y = [f for f in filtered if f.get("return_1y") is not None]
        if len(with_1y) < 3:
            data_warning = (
                f"Only {len(with_1y)} funds have 1Y return data in these categories. "
                f"Including all {len(filtered)} funds. Consider widening the category filter."
            )
        else:
            filtered = with_1y

    ctx.deps.filtered_ids = [f["fund_id"] for f in filtered]

    summary = [
        {
            "fund_id":           f["fund_id"],
            "fund_name":         f["fund_name"],
            "amc_name":          f["amc_name"],
            "category":          f["category"],
            "shariah_flag":      f["shariah_flag"],
            "performance_score": _clean(f.get("performance_score")),
            "risk_score":        _clean(f.get("risk_score")),
            "cost_score":        _clean(f.get("cost_score")),
        }
        for f in filtered
    ]

    result = {"matched_count": len(filtered), "funds": summary}
    if data_warning:
        result["data_warning"] = data_warning

    shariah_label = (
        "strict Shariah mandate" if shariah_flag is True else
        "conventional-only screen" if shariah_flag is False else
        "mixed universe"
    )
    _emit_progress(
        ctx,
        status="completed",
        stage="filtering",
        tool="filter_funds",
        context={
            "matched_count": len(filtered),
            "shariah_label": shariah_label,
            "data_warning": data_warning,
        },
    )
    return json.dumps(result)


@agent.tool
def rank_funds(
    ctx:      RunContext[AnalystDeps],
    metric:   RankMetric,
    order:    Literal["asc", "desc"],
    fund_ids: Optional[List[str]] = None,
    top_n:    int                  = 10,
) -> str:
    """
    Sort a set of funds by a single metric and return the top N.
    Call after filter_funds. fund_ids defaults to ctx.deps.filtered_ids.

    metric: the field to sort by (see enum for valid values).
    order: 'desc' when higher is better (returns, scores, Sharpe).
           'asc'  when lower is better (expense_ratio, max_drawdown, volatility).
    top_n: how many results to return. Default 10.
    """
    ids       = fund_ids if fund_ids is not None else ctx.deps.filtered_ids
    id_set    = set(ids)
    eligible  = [
        f for f in FUNDS_LIST
        if f["fund_id"] in id_set and _clean(f.get(metric)) is not None
    ]

    ascending = (order == "asc")
    ranked    = sorted(eligible, key=lambda f: f[metric], reverse=not ascending)[:top_n]

    display_cols = ["fund_id", "fund_name", "amc_name", "category",
                    metric, "return_1y", "expense_ratio", "shariah_flag"]

    funds_out = []
    for i, f in enumerate(ranked):
        entry        = {c: _clean(f.get(c)) for c in display_cols}
        entry["rank"] = i + 1
        funds_out.append(entry)

    if ranked:
        leader = ranked[0]
        _emit_progress(
            ctx,
            stage="ranking",
            tool="rank_funds",
            context={
                "metric": metric,
                "order": order,
                "ranked_count": len(ranked),
                "leader_name": leader["fund_name"],
                "leader_fund_id": leader["fund_id"],
            },
        )

    return json.dumps({
        "metric":        metric,
        "order":         order,
        "ranked_count":  len(ranked),
        "funds":         funds_out,
    })


@agent.tool
def get_fund(ctx: RunContext[AnalystDeps], fund_id: str) -> str:
    """
    Retrieve the complete feature record for a single fund.
    Auto-attaches fundlens_score, scores_used, and scores_missing using
    the investor's scoring weights — ready to use in the final shortlist.
    In any natural-language reasoning, refer to fundlens_score as the Gullak Score.
    """
    fund = FUNDS_INDEX.get(fund_id)
    if not fund:
        return json.dumps({"error": f"fund_id '{fund_id}' not found"})

    _emit_progress(
        ctx,
        stage="inspection",
        tool="get_fund",
        context={
            "fund_id": fund["fund_id"],
            "fund_name": fund["fund_name"],
            "category": fund.get("category"),
            "amc_name": fund.get("amc_name"),
        },
    )

    result = {k: _clean(v) for k, v in fund.items()}
    result.update(compute_fundlens_score(fund, ctx.deps.scoring_weights))
    return json.dumps(result)


@agent.tool
def compare_funds(
    ctx:      RunContext[AnalystDeps],
    fund_ids: List[str],
    metrics:  Optional[List[str]] = None,
) -> str:
    """
    Generate a structured side-by-side comparison of 2–5 funds.
    Use this to verify the shortlist is well-differentiated before finalising.
    Also returns a highlight block naming the best fund per metric.

    fund_ids: 2–5 fund IDs to compare.
    metrics: specific fields to compare. Defaults to the standard comparison set.
    """
    if not (2 <= len(fund_ids) <= 5):
        return json.dumps({"error": "fund_ids must contain 2–5 fund IDs"})

    default_metrics = [
        "return_1y", "return_3y_ann", "sharpe_ratio",
        "expense_ratio", "expense_vs_category", "max_drawdown",
        "upside_capture_ratio", "downside_capture_ratio",
        "performance_score", "risk_score", "cost_score",
        "consistency_score", "capture_score",
    ]
    use_metrics = metrics if metrics else default_metrics

    comparison      = []
    best: dict      = {}   # metric → (fund_id, best_value)

    for fid in fund_ids:
        fund = FUNDS_INDEX.get(fid)
        if not fund:
            continue

        entry = {
            "fund_id":   fund["fund_id"],
            "fund_name": fund["fund_name"],
            "amc_name":  fund["amc_name"],
        }
        for m in use_metrics:
            entry[m] = _clean(fund.get(m))

        entry.update(compute_fundlens_score(fund, ctx.deps.scoring_weights))
        comparison.append(entry)

        for m in use_metrics:
            val = entry.get(m)
            if val is None:
                continue
            lower_better = m in LOWER_IS_BETTER
            if m not in best:
                best[m] = (fid, val)
            else:
                _, current_best = best[m]
                if (lower_better and val < current_best) or (not lower_better and val > current_best):
                    best[m] = (fid, val)

    highlight = {f"best_{m}": fid for m, (fid, _) in best.items()}

    _emit_progress(
        ctx,
        stage="comparison",
        tool="compare_funds",
        context={
            "fund_count": len(comparison),
            "fund_ids": fund_ids,
            "metrics": use_metrics,
        },
    )

    return json.dumps({"comparison": comparison, "highlight": highlight})


@agent.tool
def get_category_stats(ctx: RunContext[AnalystDeps], category: str) -> str:
    """
    Get aggregate statistics (mean, median, min, max, p25, p75) for a fund category.
    Always call this for the primary shortlist category before returning the final output.
    Agent 3 uses these to say 'better than average' or 'top quartile'.
    """
    cat_funds = [f for f in FUNDS_LIST if f.get("category") == category]
    if not cat_funds:
        return json.dumps({"error": f"No funds found for category: '{category}'"})

    stat_fields = [
        "return_1y", "return_3y_ann", "sharpe_ratio", "sortino_ratio",
        "expense_ratio", "volatility_monthly", "max_drawdown",
        "performance_score", "risk_score", "cost_score",
        "consistency_score", "capture_score",
    ]

    stats = {}
    for field_name in stat_fields:
        values = [f.get(field_name) for f in cat_funds]
        s = _field_stats(values)
        if s:
            stats[field_name] = s

    # Grab benchmark from the first fund that has it
    benchmark_name   = next((f["benchmark_name"]      for f in cat_funds if f.get("benchmark_name")),      None)
    benchmark_return = next((f["benchmark_return_1y"] for f in cat_funds if f.get("benchmark_return_1y")), None)

    _emit_progress(
        ctx,
        status="completed",
        stage="category-context",
        tool="get_category_stats",
        context={
            "category": category,
            "fund_count": len(cat_funds),
            "benchmark_name": benchmark_name,
        },
    )

    return json.dumps({
        "category":            category,
        "fund_count":          len(cat_funds),
        "stats":               stats,
        "benchmark_name":      benchmark_name,
        "benchmark_return_1y": _clean(benchmark_return),
        "risk_free_rate":      RISK_FREE_RATE,  # hardcoded T-bill baseline
    })


# ---------------------------------------------------------------------------
# 8. RUNNER  (called by orchestrator.py)
# ---------------------------------------------------------------------------

def run_analyst(
    investor_profile: dict,
    progress_callback: Optional[Callable[[str, str, str, str, Optional[str], Optional[str]], None]] = None,
) -> dict:
    """
    Pure function. Receives a translated investor profile dict from the orchestrator.
    Returns the AnalystOutput as a plain dict ready to pass to run_explainer.
    No DynamoDB. No side effects.
    """
    weights = get_weight_preset(
        investor_profile.get("risk_tolerance", "medium"),
        investor_profile.get("time_horizon",   "medium"),
    )

    deps = AnalystDeps(
        investor_profile=investor_profile,
        scoring_weights=weights,
        progress_callback=progress_callback,
    )

    if progress_callback:
        narration = narrate_progress("Analyst", "setup", None, "running", {
            "risk_tolerance": investor_profile.get("risk_tolerance", "medium"),
            "time_horizon": investor_profile.get("time_horizon", "medium"),
            "goal_summary": investor_profile.get("goal_summary"),
            "monthly_amount": investor_profile.get("monthly_amount"),
        })
        progress_callback("Analyst", narration["message"], "running", "setup", None, narration["detail"])

    user_message = (
        "Analyse the following investor profile and find the best Pakistani mutual fund "
        "recommendations from our dataset.\n\n"
        f"INVESTOR PROFILE:\n{json.dumps(investor_profile, indent=2)}\n\n"
        f"SCORING WEIGHTS FOR THIS PROFILE:\n{json.dumps(weights, indent=2)}\n\n"
        "Use your tools to filter, rank, compare, and finalise a shortlist of 3–5 funds. "
        "Call get_category_stats before returning the final AnalystOutput."
    )

    result = agent.run_sync(user_message, deps=deps)
    output = result.output.model_dump()
    output["risk_free_rate"] = RISK_FREE_RATE  # always enforce hardcoded T-bill rate

    if progress_callback:
        narration = narrate_progress("Analyst", "final-shortlist", None, "completed", {
            "shortlist_count": len(output.get("shortlist", [])),
            "top_fund": (output.get("shortlist") or [{}])[0].get("fund_name"),
            "risk_tolerance": investor_profile.get("risk_tolerance", "medium"),
            "time_horizon": investor_profile.get("time_horizon", "medium"),
        })
        progress_callback("Analyst", narration["message"], "completed", "final-shortlist", None, narration["detail"])
    return output
