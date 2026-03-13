from __future__ import annotations

import argparse
import csv
from pathlib import Path

from benchmark_policy import POLICY_VERSION, is_known_category, resolve_benchmark_name


DEFAULT_DIRECTORY = Path("fund_directory.csv")
DEFAULT_OUTPUT = Path("fund_benchmark_mapping.csv")
FIELDNAMES = [
    "fund_id",
    "fund_name",
    "category",
    "shariah_flag",
    "benchmark_name",
    "policy_status",
]


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", newline="", encoding="utf-8-sig") as csv_file:
        return list(csv.DictReader(csv_file))


def build_records(directory_rows: list[dict[str, str]]) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    for row in directory_rows:
        category = row["category"]
        benchmark_name = resolve_benchmark_name(category)
        records.append(
            {
                "fund_id": row["fund_id"],
                "fund_name": row["fund_name"],
                "category": category,
                "shariah_flag": row["shariah_flag"],
                "benchmark_name": benchmark_name or "",
                "policy_status": "mapped" if is_known_category(category) else "unknown_category",
            }
        )

    records.sort(key=lambda item: (item["fund_name"], item["fund_id"]))
    return records


def write_rows(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Resolve FundLens benchmark_name values from MUFAP fund categories."
    )
    parser.add_argument(
        "--directory-file",
        type=Path,
        default=DEFAULT_DIRECTORY,
        help="Path to fund_directory.csv. Defaults to fund_directory.csv.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output CSV path. Defaults to fund_benchmark_mapping.csv.",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    directory_rows = read_rows(args.directory_file)
    records = build_records(directory_rows)
    unknown_categories = sorted(
        {row["category"] for row in records if row["policy_status"] == "unknown_category"}
    )

    write_rows(args.output, records)
    print(
        f"Wrote {len(records)} benchmark mappings to {args.output} using policy {POLICY_VERSION}. "
        f"Unknown categories: {len(unknown_categories)}"
    )
    if unknown_categories:
        print("Unknown categories: " + ", ".join(unknown_categories))


if __name__ == "__main__":
    main()