from __future__ import annotations

from typing import Final


POLICY_VERSION: Final[str] = "v1"

KSE100_CATEGORIES: Final[frozenset[str]] = frozenset(
    {
        "Asset Allocation",
        "Balanced",
        "Capital Protected",
        "Dedicated Equity",
        "Equity",
        "Exchange Traded Fund",
        "Fund of Funds",
        "Index Tracker",
        "VPS-Equity",
    }
)

KMI30_CATEGORIES: Final[frozenset[str]] = frozenset(
    {
        "Shariah Compliant Asset Allocation",
        "Shariah Compliant Balanced",
        "Shariah Compliant Capital Protected",
        "Shariah Compliant Dedicated Equity",
        "Shariah Compliant Equity",
        "Shariah Compliant Exchange Traded Fund",
        "Shariah Compliant Fund of Funds",
        "Shariah Compliant Index Tracker",
        "VPS-Shariah Compliant Equity",
    }
)

NULL_BENCHMARK_CATEGORIES: Final[frozenset[str]] = frozenset(
    {
        "Aggressive Fixed Income",
        "Capital Protected - Income",
        "Fixed Rate / Return",
        "Income",
        "Money Market",
        "Shariah Compliant Aggressive Fixed Income",
        "Shariah Compliant Commodities",
        "Shariah Compliant Fixed Rate / Return",
        "Shariah Compliant Fund of Funds - CPPI",
        "Shariah Compliant Income",
        "Shariah Compliant Money Market",
        "VPS-Commodities / Gold",
        "VPS-Debt",
        "VPS-Money Market",
        "VPS-Shariah Compliant Commodities / Gold",
        "VPS-Shariah Compliant Debt",
        "VPS-Shariah Compliant Money Market",
    }
)

CATEGORY_TO_BENCHMARK: Final[dict[str, str | None]] = {
    **{category: "KSE100" for category in KSE100_CATEGORIES},
    **{category: "KMI30" for category in KMI30_CATEGORIES},
    **{category: None for category in NULL_BENCHMARK_CATEGORIES},
}


def resolve_benchmark_name(category: str) -> str | None:
    return CATEGORY_TO_BENCHMARK.get(category)


def is_known_category(category: str) -> bool:
    return category in CATEGORY_TO_BENCHMARK


def known_categories() -> list[str]:
    return sorted(CATEGORY_TO_BENCHMARK)