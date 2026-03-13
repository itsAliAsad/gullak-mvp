from __future__ import annotations

import argparse
import csv
import json
import math
from bisect import bisect_right
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from statistics import mean, stdev

from benchmark_policy import POLICY_VERSION, is_known_category, resolve_benchmark_name


DEFAULT_DIRECTORY = Path("fund_directory.csv")
DEFAULT_NAV = Path("nav_daily_with_ids.csv")
DEFAULT_NAV_FALLBACK_FILTERED = Path("nav_daily_filtered.csv")
DEFAULT_NAV_FALLBACK = Path("nav_daily.csv")
DEFAULT_EXPENSES = Path("expense_ratios.csv")
DEFAULT_BENCHMARKS = Path("benchmark_daily.csv")
DEFAULT_RISK_FREE_RATE = Path("2.5 risk_free_rate.json")
DEFAULT_RETURNS = Path("fund_returns.csv")
DEFAULT_OUTPUT = Path("fund_features.json")

RISK_METRIC_LOOKBACK_YEARS = 3


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class TimeSeries:
    dates: list[date]
    values: list[float]


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def parse_iso_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def subtract_years(day: date, years: int) -> date:
    try:
        return day.replace(year=day.year - years)
    except ValueError:
        return day.replace(month=2, day=28, year=day.year - years)


def round_or_none(value: float | None, digits: int = 6) -> float | None:
    if value is None:
        return None
    return round(value, digits)


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", newline="", encoding="utf-8-sig") as csv_file:
        return list(csv.DictReader(csv_file))


def has_fund_id_column(rows: list[dict[str, str]]) -> bool:
    return bool(rows) and "fund_id" in rows[0] and any(row.get("fund_id") for row in rows)


def choose_nav_file(path: Path | None) -> Path:
    if path is not None:
        return path
    for candidate in (DEFAULT_NAV, DEFAULT_NAV_FALLBACK_FILTERED, DEFAULT_NAV_FALLBACK):
        if candidate.exists():
            return candidate
    return DEFAULT_NAV_FALLBACK


def parse_optional_float(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def mufap_return_or_none(value: str | None) -> float | None:
    """Parse a MUFAP return value — treats 0.0 as missing (API returns 0 for N/A periods)."""
    f = parse_optional_float(value)
    if f is None or f == 0.0:
        return None
    return f


# ---------------------------------------------------------------------------
# Time series construction
# ---------------------------------------------------------------------------

def build_time_series(rows: list[dict[str, str]], date_key: str, value_key: str) -> TimeSeries:
    by_date: dict[date, float] = {}
    for row in rows:
        try:
            value = float(row[value_key])
        except (KeyError, TypeError, ValueError):
            continue
        if value <= 0:
            continue
        point_date = parse_iso_date(row[date_key])
        by_date[point_date] = value

    ordered_dates = sorted(by_date)
    ordered_values = [by_date[d] for d in ordered_dates]
    return TimeSeries(dates=ordered_dates, values=ordered_values)


def build_nav_histories(rows: list[dict[str, str]], key_field: str) -> dict[str, TimeSeries]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        entity_key = row.get(key_field)
        if not entity_key:
            continue
        grouped[entity_key].append(row)
    return {
        key: build_time_series(fund_rows, "date", "nav")
        for key, fund_rows in grouped.items()
    }


def build_benchmark_histories(rows: list[dict[str, str]]) -> dict[str, TimeSeries]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        grouped[row["benchmark_name"]].append(row)
    return {
        name: build_time_series(bm_rows, "date", "index_level")
        for name, bm_rows in grouped.items()
    }


def build_front_end_load_lookup(rows: list[dict[str, str]], key_field: str) -> dict[str, float | None]:
    """Return the most recent front_end_load value per fund."""
    latest: dict[str, tuple[date, float | None]] = {}
    for row in rows:
        key = row.get(key_field)
        if not key:
            continue
        try:
            row_date = parse_iso_date(row["date"])
        except (KeyError, ValueError):
            continue
        load = parse_optional_float(row.get("front_end_load"))
        existing = latest.get(key)
        if existing is None or row_date > existing[0]:
            latest[key] = (row_date, load)
    return {key: val[1] for key, val in latest.items()}


# ---------------------------------------------------------------------------
# MUFAP returns lookup
# ---------------------------------------------------------------------------

def build_mufap_returns_lookup(rows: list[dict[str, str]]) -> dict[str, dict[str, float | None]]:
    lookup: dict[str, dict[str, float | None]] = {}
    for row in rows:
        fund_id = row.get("fund_id", "").strip()
        if not fund_id:
            continue
        lookup[fund_id] = {
            "return_ytd": mufap_return_or_none(row.get("return_ytd")),
            "return_mtd": mufap_return_or_none(row.get("return_mtd")),
            "return_1m":  mufap_return_or_none(row.get("return_1m")),
            "return_3m":  mufap_return_or_none(row.get("return_3m")),
            "return_6m":  mufap_return_or_none(row.get("return_6m")),
            "return_9m":  mufap_return_or_none(row.get("return_9m")),
            "return_1y":  mufap_return_or_none(row.get("return_1y")),
            "return_2y":  mufap_return_or_none(row.get("return_2y")),
            "return_3y":  mufap_return_or_none(row.get("return_3y")),
        }
    return lookup


# ---------------------------------------------------------------------------
# Expense lookups
# ---------------------------------------------------------------------------

def build_expense_lookup(rows: list[dict[str, str]]) -> dict[str, float]:
    counts = Counter(row["fund_name"] for row in rows)
    lookup: dict[str, float] = {}
    for row in rows:
        fund_name = row["fund_name"]
        if counts[fund_name] != 1:
            continue
        try:
            lookup[fund_name] = float(row["expense_ratio_pct"])
        except ValueError:
            continue
    return lookup


def build_directory_index(
    rows: list[dict[str, str]],
) -> tuple[dict[str, dict[str, str]], dict[str, dict[str, str]], set[str]]:
    counts = Counter(row["fund_name"] for row in rows)
    ambiguous_names = {name for name, count in counts.items() if count > 1}
    unique_rows_by_name = {
        row["fund_name"]: row for row in rows if row["fund_name"] not in ambiguous_names
    }
    rows_by_id = {row["fund_id"]: row for row in rows}
    return rows_by_id, unique_rows_by_name, ambiguous_names


def compute_category_averages(
    directory_rows_by_name: dict[str, dict[str, str]], expense_lookup: dict[str, float]
) -> dict[str, float]:
    category_values: dict[str, list[float]] = defaultdict(list)
    for fund_name, directory_row in directory_rows_by_name.items():
        expense_ratio = expense_lookup.get(fund_name)
        if expense_ratio is None:
            continue
        category_values[directory_row["category"]].append(expense_ratio)
    return {category: mean(values) for category, values in category_values.items() if values}


# ---------------------------------------------------------------------------
# Monthly returns
# ---------------------------------------------------------------------------

def build_monthly_returns(
    series: TimeSeries, start_date: date, end_date: date
) -> dict[tuple[int, int], float]:
    """Resample daily NAV to last-day-of-month, return dict of (year, month) -> monthly_return."""
    monthly_nav: dict[tuple[int, int], float] = {}
    for d, v in zip(series.dates, series.values):
        if d < start_date or d > end_date:
            continue
        monthly_nav[(d.year, d.month)] = v  # last day of month wins (dates are sorted)

    sorted_keys = sorted(monthly_nav)
    if len(sorted_keys) < 2:
        return {}

    monthly_returns: dict[tuple[int, int], float] = {}
    for i in range(1, len(sorted_keys)):
        prev_key = sorted_keys[i - 1]
        curr_key = sorted_keys[i]
        prev_nav = monthly_nav[prev_key]
        if prev_nav > 0:
            monthly_returns[curr_key] = monthly_nav[curr_key] / prev_nav - 1.0
    return monthly_returns


# ---------------------------------------------------------------------------
# Risk metrics
# ---------------------------------------------------------------------------

def compute_risk_metrics(
    monthly_returns: dict[tuple[int, int], float],
) -> dict[str, float | None]:
    returns = list(monthly_returns.values())

    if len(returns) < 6:
        return {
            "volatility_monthly": None,
            "downside_deviation": None,
            "rolling_return_12m_avg": None,
            "rolling_return_12m_stddev": None,
        }

    vol = stdev(returns) if len(returns) >= 2 else None

    neg_returns = [r for r in returns if r < 0]
    if len(neg_returns) >= 2:
        downside_dev: float | None = stdev(neg_returns)
    elif len(neg_returns) == 1:
        downside_dev = abs(neg_returns[0])
    else:
        downside_dev = 0.0

    rolling_12m: list[float] = []
    if len(returns) >= 12:
        for i in range(len(returns) - 11):
            compound = 1.0
            for r in returns[i : i + 12]:
                compound *= 1.0 + r
            rolling_12m.append(compound - 1.0)

    return {
        "volatility_monthly": vol,
        "downside_deviation": downside_dev,
        "rolling_return_12m_avg": mean(rolling_12m) if rolling_12m else None,
        "rolling_return_12m_stddev": stdev(rolling_12m) if len(rolling_12m) >= 2 else None,
    }


def compute_max_drawdown(
    series: TimeSeries, start_date: date, end_date: date
) -> dict[str, float | None]:
    window = [(d, v) for d, v in zip(series.dates, series.values) if start_date <= d <= end_date]
    if len(window) < 2:
        return {"max_drawdown": None, "max_drawdown_recovery_days": None}

    current_peak_val = window[0][1]
    current_peak_date = window[0][0]
    max_dd = 0.0
    worst_trough_date: date | None = None
    worst_peak_val: float | None = None

    for d, v in window:
        if v >= current_peak_val:
            current_peak_val = v
            current_peak_date = d
        else:
            dd = (v - current_peak_val) / current_peak_val
            if dd < max_dd:
                max_dd = dd
                worst_trough_date = d
                worst_peak_val = current_peak_val

    if worst_trough_date is None:
        return {"max_drawdown": 0.0, "max_drawdown_recovery_days": 0}

    recovery_days: int | None = None
    if worst_peak_val is not None:
        for d, v in window:
            if d > worst_trough_date and v >= worst_peak_val:
                recovery_days = (d - worst_trough_date).days
                break

    return {"max_drawdown": max_dd, "max_drawdown_recovery_days": recovery_days}


# ---------------------------------------------------------------------------
# Risk-adjusted metrics
# ---------------------------------------------------------------------------

def compute_sharpe_sortino(
    annual_return: float | None,
    volatility_monthly: float | None,
    downside_deviation: float | None,
    rfr_annual_pct: float,
) -> tuple[float | None, float | None]:
    rfr = rfr_annual_pct / 100.0
    if annual_return is None:
        return None, None
    excess = annual_return - rfr

    sharpe = None
    if volatility_monthly is not None and volatility_monthly > 0:
        sharpe = excess / (volatility_monthly * math.sqrt(12))

    sortino = None
    if downside_deviation is not None and downside_deviation > 0:
        sortino = excess / (downside_deviation * math.sqrt(12))

    return sharpe, sortino


# ---------------------------------------------------------------------------
# Benchmark metrics
# ---------------------------------------------------------------------------

def _trailing_return(series: TimeSeries, as_of: date, anchor: date) -> float | None:
    _MAX_SLIP = 7
    curr_idx = bisect_right(series.dates, as_of) - 1
    if curr_idx < 0:
        return None
    anc_idx = bisect_right(series.dates, anchor) - 1
    if anc_idx < 0:
        fwd_idx = bisect_right(series.dates, anchor)
        if fwd_idx < len(series.dates) and (series.dates[fwd_idx] - anchor).days <= _MAX_SLIP:
            anc_idx = fwd_idx
        else:
            return None
    if series.dates[anc_idx] >= as_of or series.values[anc_idx] <= 0:
        return None
    return series.values[curr_idx] / series.values[anc_idx] - 1.0


def compute_benchmark_metrics(
    fund_monthly: dict[tuple[int, int], float],
    benchmark_monthly: dict[tuple[int, int], float],
    fund_annual_return: float | None,
    benchmark_series: TimeSeries,
    as_of_date: date,
    rfr_annual_pct: float,
) -> dict[str, float | None]:
    bm_1y = _trailing_return(benchmark_series, as_of_date, subtract_years(as_of_date, 1))

    common_keys = sorted(set(fund_monthly) & set(benchmark_monthly))
    if len(common_keys) < 12:
        return {
            "beta": None, "alpha": None,
            "upside_capture_ratio": None, "downside_capture_ratio": None,
            "benchmark_return_1y": bm_1y,
        }

    fund_rets = [fund_monthly[k] for k in common_keys]
    bm_rets   = [benchmark_monthly[k] for k in common_keys]

    fm   = mean(fund_rets)
    bm_m = mean(bm_rets)
    cov    = sum((f - fm) * (b - bm_m) for f, b in zip(fund_rets, bm_rets)) / (len(common_keys) - 1)
    var_bm = sum((b - bm_m) ** 2 for b in bm_rets) / (len(common_keys) - 1)
    beta: float | None = cov / var_bm if var_bm > 1e-10 else None

    rfr = rfr_annual_pct / 100.0
    alpha: float | None = None
    if beta is not None and fund_annual_return is not None and bm_1y is not None:
        alpha = fund_annual_return - (rfr + beta * (bm_1y - rfr))

    up_pairs = [(f, b) for f, b in zip(fund_rets, bm_rets) if b > 0]
    dn_pairs = [(f, b) for f, b in zip(fund_rets, bm_rets) if b < 0]

    upside_capture: float | None = None
    if up_pairs:
        fu, bu = 1.0, 1.0
        for f, b in up_pairs:
            fu *= 1.0 + f
            bu *= 1.0 + b
        if abs(bu - 1.0) > 1e-10:
            upside_capture = (fu - 1.0) / (bu - 1.0) * 100.0

    downside_capture: float | None = None
    if dn_pairs:
        fd, bd = 1.0, 1.0
        for f, b in dn_pairs:
            fd *= 1.0 + f
            bd *= 1.0 + b
        if abs(bd - 1.0) > 1e-10:
            downside_capture = (fd - 1.0) / (bd - 1.0) * 100.0

    return {
        "beta": beta,
        "alpha": alpha,
        "upside_capture_ratio": upside_capture,
        "downside_capture_ratio": downside_capture,
        "benchmark_return_1y": bm_1y,
    }


# ---------------------------------------------------------------------------
# Per-fund record assembly
# ---------------------------------------------------------------------------

def compute_fund_record(
    directory_row: dict[str, str],
    nav_series: TimeSeries,
    mufap_returns: dict[str, float | None],
    expense_lookup: dict[str, float],
    category_average_lookup: dict[str, float],
    front_end_load: float | None,
    benchmark_series: TimeSeries | None,
    rfr_annual_pct: float,
) -> dict[str, object] | None:
    if not nav_series.dates:
        return None

    as_of_date = nav_series.dates[-1]
    fund_name = directory_row["fund_name"]
    category = directory_row["category"]
    benchmark_name = resolve_benchmark_name(category)

    r = mufap_returns

    # NAV-based risk metrics (trailing 3 years)
    start_date = subtract_years(as_of_date, RISK_METRIC_LOOKBACK_YEARS)
    fund_monthly = build_monthly_returns(nav_series, start_date, as_of_date)
    risk = compute_risk_metrics(fund_monthly)
    drawdown = compute_max_drawdown(nav_series, start_date, as_of_date)

    sharpe, sortino = compute_sharpe_sortino(
        annual_return=r.get("return_1y"),
        volatility_monthly=risk["volatility_monthly"],
        downside_deviation=risk["downside_deviation"],
        rfr_annual_pct=rfr_annual_pct,
    )

    bm_metrics: dict[str, float | None] = {
        "beta": None, "alpha": None,
        "upside_capture_ratio": None, "downside_capture_ratio": None,
        "benchmark_return_1y": None,
    }
    if benchmark_series is not None:
        bm_monthly = build_monthly_returns(benchmark_series, start_date, as_of_date)
        bm_metrics = compute_benchmark_metrics(
            fund_monthly=fund_monthly,
            benchmark_monthly=bm_monthly,
            fund_annual_return=r.get("return_1y"),
            benchmark_series=benchmark_series,
            as_of_date=as_of_date,
            rfr_annual_pct=rfr_annual_pct,
        )

    expense_ratio = expense_lookup.get(fund_name)
    category_average = category_average_lookup.get(category)

    return {
        # Identity
        "fund_id":    directory_row["fund_id"],
        "fund_name":  fund_name,
        "amc_name":   directory_row["amc_name"],
        "category":   category,
        "fund_type":  directory_row["fund_type"],
        "risk_profile": directory_row["risk_profile"],
        "shariah_flag": directory_row["shariah_flag"].lower() == "true",
        "as_of_date": as_of_date.isoformat(),
        "benchmark_name": benchmark_name,
        "benchmark_policy_known_category": is_known_category(category),
        # Returns — MUFAP (dividend-adjusted, annualized per MUFAP methodology)
        "return_ytd": round_or_none(r.get("return_ytd")),
        "return_mtd": round_or_none(r.get("return_mtd")),
        "return_1m":  round_or_none(r.get("return_1m")),
        "return_3m":  round_or_none(r.get("return_3m")),
        "return_6m":  round_or_none(r.get("return_6m")),
        "return_9m":  round_or_none(r.get("return_9m")),
        "return_1y":  round_or_none(r.get("return_1y")),
        "return_2y":  round_or_none(r.get("return_2y")),
        "return_3y":  round_or_none(r.get("return_3y")),
        "return_3y_ann": round_or_none(
            (1.0 + r["return_3y"]) ** (1.0 / 3.0) - 1.0
            if r.get("return_3y") is not None and r["return_3y"] > -1.0
            else None
        ),
        # Risk metrics (NAV history, trailing 3 years)
        "volatility_monthly":        round_or_none(risk["volatility_monthly"]),
        "downside_deviation":        round_or_none(risk["downside_deviation"]),
        "max_drawdown":              round_or_none(drawdown["max_drawdown"]),
        "max_drawdown_recovery_days": drawdown["max_drawdown_recovery_days"],
        "rolling_return_12m_avg":    round_or_none(risk["rolling_return_12m_avg"]),
        "rolling_return_12m_stddev": round_or_none(risk["rolling_return_12m_stddev"]),
        # Risk-adjusted
        "sharpe_ratio":  round_or_none(sharpe),
        "sortino_ratio": round_or_none(sortino),
        # Benchmark metrics
        "benchmark_return_1y":    round_or_none(bm_metrics["benchmark_return_1y"]),
        "excess_return_1y":       round_or_none(
            r.get("return_1y") - bm_metrics["benchmark_return_1y"]
            if r.get("return_1y") is not None and bm_metrics["benchmark_return_1y"] is not None
            else None
        ),
        "beta":                   round_or_none(bm_metrics["beta"]),
        "alpha":                  round_or_none(bm_metrics["alpha"]),
        "upside_capture_ratio":   round_or_none(bm_metrics["upside_capture_ratio"]),
        "downside_capture_ratio": round_or_none(bm_metrics["downside_capture_ratio"]),
        # Cost
        "expense_ratio":       round_or_none(expense_ratio),
        "expense_vs_category": round_or_none(
            expense_ratio - category_average
            if expense_ratio is not None and category_average is not None
            else None
        ),
        "front_end_load": round_or_none(front_end_load),
        # Context
        "risk_free_rate": round_or_none(rfr_annual_pct / 100.0),
        # Composite scores — populated by compute_composite_scores()
        "performance_score": None,
        "risk_score":        None,
        "cost_score":        None,
        "consistency_score": None,
        "capture_score":     None,
    }


# ---------------------------------------------------------------------------
# Composite scoring (1–10, normalized within category)
# ---------------------------------------------------------------------------

def _percentile_score(value: float, all_values: list[float], higher_is_better: bool) -> float:
    """Map value to 1–10 based on its percentile rank within peers."""
    if len(all_values) <= 1:
        return 5.5
    n_below = sum(1 for v in all_values if (v < value if higher_is_better else v > value))
    rank = n_below / (len(all_values) - 1)
    return round(1.0 + 9.0 * rank, 2)


def compute_composite_scores(records: list[dict[str, object]]) -> None:
    """Inject composite scores in-place. Each score is 1–10 within its category."""
    by_category: dict[str, list[dict[str, object]]] = defaultdict(list)
    for rec in records:
        by_category[str(rec["category"])].append(rec)

    for cat_records in by_category.values():

        def vals(field: str) -> dict[str, float]:
            return {
                str(r["fund_id"]): float(r[field])  # type: ignore[arg-type]
                for r in cat_records
                if r.get(field) is not None
            }

        r1y   = vals("return_1y")
        r3y   = vals("return_3y")
        r_avg = vals("rolling_return_12m_avg")
        alpha = vals("alpha")

        # --- Performance: return_1y 45%, return_3y 35%, rolling_avg 20% + alpha bonus ---
        perf_raw: dict[str, float] = {}
        for fid in set(r1y) | set(r3y) | set(r_avg):
            parts: list[tuple[float, float]] = []
            if fid in r1y:   parts.append((r1y[fid],   0.45))
            if fid in r3y:   parts.append((r3y[fid],   0.35))
            if fid in r_avg: parts.append((r_avg[fid], 0.20))
            if fid in alpha: parts.append((alpha[fid], 0.10))
            if parts:
                tw = sum(w for _, w in parts)
                perf_raw[fid] = sum(v * w for v, w in parts) / tw
        pv = list(perf_raw.values())
        for rec in cat_records:
            fid = str(rec["fund_id"])
            if fid in perf_raw:
                rec["performance_score"] = _percentile_score(perf_raw[fid], pv, True)

        # --- Risk: volatility 40%, |max_drawdown| 40%, downside_dev 20% (all inverted) ---
        vol = vals("volatility_monthly")
        mdd = {k: abs(v) for k, v in vals("max_drawdown").items()}
        dd  = vals("downside_deviation")

        risk_raw: dict[str, float] = {}
        for fid in set(vol) | set(mdd) | set(dd):
            parts = []
            if fid in vol: parts.append((vol[fid], 0.40))
            if fid in mdd: parts.append((mdd[fid], 0.40))
            if fid in dd:  parts.append((dd[fid],  0.20))
            if parts:
                tw = sum(w for _, w in parts)
                risk_raw[fid] = sum(v * w for v, w in parts) / tw
        rv = list(risk_raw.values())
        for rec in cat_records:
            fid = str(rec["fund_id"])
            if fid in risk_raw:
                rec["risk_score"] = _percentile_score(risk_raw[fid], rv, False)

        # --- Cost: expense_ratio 70%, front_end_load 30% (both inverted) ---
        er  = vals("expense_ratio")
        fel = vals("front_end_load")

        cost_raw: dict[str, float] = {}
        for fid in set(er) | set(fel):
            parts = []
            if fid in er:  parts.append((er[fid],  0.70))
            if fid in fel: parts.append((fel[fid], 0.30))
            if parts:
                tw = sum(w for _, w in parts)
                cost_raw[fid] = sum(v * w for v, w in parts) / tw
        cv = list(cost_raw.values())
        for rec in cat_records:
            fid = str(rec["fund_id"])
            if fid in cost_raw:
                rec["cost_score"] = _percentile_score(cost_raw[fid], cv, False)

        # --- Consistency: rolling_stddev 50% (inv), sharpe 30%, |max_drawdown| 20% (inv) ---
        r_std  = vals("rolling_return_12m_stddev")
        sharpe = vals("sharpe_ratio")

        con_raw: dict[str, float] = {}
        for fid in set(r_std) | set(sharpe) | set(mdd):
            # Composite where higher = worse consistency
            parts_bad: list[tuple[float, float]] = []   # higher-is-worse
            parts_good: list[tuple[float, float]] = []  # higher-is-better
            if fid in r_std: parts_bad.append((r_std[fid], 0.50))
            if fid in mdd:   parts_bad.append((mdd[fid],   0.20))
            if fid in sharpe: parts_good.append((sharpe[fid], 0.30))
            if not (parts_bad or parts_good):
                continue
            tw = sum(w for _, w in parts_bad) + sum(w for _, w in parts_good)
            raw = (
                sum(v * w for v, w in parts_bad) - sum(v * w for v, w in parts_good)
            ) / tw
            con_raw[fid] = raw
        conv = list(con_raw.values())
        for rec in cat_records:
            fid = str(rec["fund_id"])
            if fid in con_raw:
                rec["consistency_score"] = _percentile_score(con_raw[fid], conv, False)

        # --- Capture: upside_capture - downside_capture (higher = better) ---
        uc = vals("upside_capture_ratio")
        dc = vals("downside_capture_ratio")
        cap_raw = {fid: uc[fid] - dc[fid] for fid in set(uc) & set(dc)}
        capv = list(cap_raw.values())
        for rec in cat_records:
            fid = str(rec["fund_id"])
            if fid in cap_raw:
                rec["capture_score"] = _percentile_score(cap_raw[fid], capv, True)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Compute FundLens fund_features.json — the Fund Intelligence Dataset."
    )
    parser.add_argument("--directory-file", type=Path, default=DEFAULT_DIRECTORY)
    parser.add_argument("--nav-file", type=Path, default=None,
                        help="NAV CSV. Auto-selects: nav_daily_with_ids.csv > nav_daily_filtered.csv > nav_daily.csv.")
    parser.add_argument("--expense-file", type=Path, default=DEFAULT_EXPENSES)
    parser.add_argument("--benchmark-file", type=Path, default=DEFAULT_BENCHMARKS)
    parser.add_argument("--risk-free-file", type=Path, default=DEFAULT_RISK_FREE_RATE)
    parser.add_argument("--returns-file", type=Path, default=DEFAULT_RETURNS,
                        help="fund_returns.csv from scrape_fund_returns.py.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    return parser


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    args = build_parser().parse_args()
    nav_file = choose_nav_file(args.nav_file)

    print("Loading data sources...")
    directory_rows = read_csv_rows(args.directory_file)
    nav_rows       = read_csv_rows(nav_file)
    expense_rows   = read_csv_rows(args.expense_file)
    benchmark_rows = read_csv_rows(args.benchmark_file)
    returns_rows   = read_csv_rows(args.returns_file) if args.returns_file.exists() else []

    with args.risk_free_file.open("r", encoding="utf-8") as f:
        rfr_annual_pct = float(json.load(f)["rate_annual_pct"])

    directory_by_id, directory_by_name, ambiguous_names = build_directory_index(directory_rows)
    nav_uses_fund_id = has_fund_id_column(nav_rows)
    nav_key_field    = "fund_id" if nav_uses_fund_id else "fund_name"

    nav_histories      = build_nav_histories(nav_rows, nav_key_field)
    front_end_loads    = build_front_end_load_lookup(nav_rows, nav_key_field)
    expense_lookup     = build_expense_lookup(expense_rows)
    cat_avg_lookup     = compute_category_averages(directory_by_name, expense_lookup)
    benchmark_histories = build_benchmark_histories(benchmark_rows)
    mufap_returns_lookup = build_mufap_returns_lookup(returns_rows)

    print(f"  NAV file     : {nav_file} (join key: {nav_key_field})")
    print(f"  Funds in dir : {len(directory_by_id)}")
    print(f"  MUFAP returns: {len(mufap_returns_lookup)} funds")

    records: list[dict[str, object]] = []
    skipped_no_nav    = 0
    skipped_ambiguous = 0

    if nav_uses_fund_id:
        directory_items = sorted(directory_by_id.items(), key=lambda item: (item[1]["fund_name"], item[0]))
    else:
        directory_items = sorted(directory_by_name.items())

    print("Computing fund records...")
    for entity_key, directory_row in directory_items:
        if not nav_uses_fund_id and directory_row["fund_name"] in ambiguous_names:
            skipped_ambiguous += 1
            continue

        nav_series = nav_histories.get(entity_key)
        if nav_series is None or not nav_series.dates:
            skipped_no_nav += 1
            continue

        fund_id       = directory_row["fund_id"]
        category      = directory_row["category"]
        bm_name       = resolve_benchmark_name(category)
        bm_series     = benchmark_histories.get(bm_name) if bm_name else None
        mufap_returns = mufap_returns_lookup.get(fund_id, {})
        front_load    = front_end_loads.get(entity_key)

        record = compute_fund_record(
            directory_row=directory_row,
            nav_series=nav_series,
            mufap_returns=mufap_returns,
            expense_lookup=expense_lookup,
            category_average_lookup=cat_avg_lookup,
            front_end_load=front_load,
            benchmark_series=bm_series,
            rfr_annual_pct=rfr_annual_pct,
        )
        if record is not None:
            records.append(record)

    print(f"  {len(records)} records computed. Running composite scoring...")
    compute_composite_scores(records)

    funds_with_scores  = sum(1 for r in records if r.get("performance_score") is not None)
    funds_with_capture = sum(1 for r in records if r.get("capture_score") is not None)
    max_as_of_date     = max((str(r["as_of_date"]) for r in records), default=None)
    unknown_categories = sorted(
        {row["category"] for row in directory_rows if not is_known_category(row["category"])}
    )

    output_payload = {
        "generated_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "as_of_date": max_as_of_date,
        "benchmark_policy_version": POLICY_VERSION,
        "input_files": {
            "fund_directory":  str(args.directory_file),
            "nav_daily":       str(nav_file),
            "expense_ratios":  str(args.expense_file),
            "benchmark_daily": str(args.benchmark_file),
            "risk_free_rate":  str(args.risk_free_file),
            "mufap_returns":   str(args.returns_file),
        },
        "summary": {
            "funds_output":              len(records),
            "fund_directory_rows":       len(directory_rows),
            "nav_join_key":              nav_key_field,
            "ambiguous_fund_name_count": len(ambiguous_names),
            "skipped_ambiguous_count":   skipped_ambiguous,
            "skipped_no_nav_count":      skipped_no_nav,
            "funds_with_mufap_returns":  len(mufap_returns_lookup),
            "funds_with_composite_scores": funds_with_scores,
            "funds_with_capture_scores": funds_with_capture,
            "unknown_category_count":    len(unknown_categories),
            "unknown_category_samples":  unknown_categories[:10],
        },
        "funds": records,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as f:
        json.dump(output_payload, f, indent=2)
        f.write("\n")

    print(
        f"\nWrote {len(records)} fund records to {args.output}\n"
        f"  With composite scores : {funds_with_scores}\n"
        f"  With capture scores   : {funds_with_capture}\n"
        f"  Skipped (no NAV)      : {skipped_no_nav}\n"
        f"  Skipped (ambiguous)   : {skipped_ambiguous}"
    )


if __name__ == "__main__":
    main()
