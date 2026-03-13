from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Iterable

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


BENCHMARK_ENDPOINTS = {
    "KSE30": "https://dps.psx.com.pk/timeseries/eod/KSE30",
    "KSE100": "https://dps.psx.com.pk/timeseries/eod/KSE100",
    "KMI30": "https://dps.psx.com.pk/timeseries/eod/KMI30",
}
DEFAULT_OUTPUT = Path("benchmark_daily.csv")
FIELDNAMES = ["date", "benchmark_name", "index_level", "volume", "open_candidate"]
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
)


def format_decimal(value: Decimal) -> str:
    return format(value, ".4f")


def build_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=5,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.headers.update({"User-Agent": USER_AGENT})
    return session


def fetch_timeseries(session: requests.Session, benchmark_name: str) -> list[list[object]]:
    response = session.get(BENCHMARK_ENDPOINTS[benchmark_name], timeout=120)
    response.raise_for_status()

    payload = response.json()
    if payload.get("status") != 1:
        raise ValueError(f"PSX endpoint returned non-success status for {benchmark_name}: {payload}")

    data = payload.get("data")
    if not isinstance(data, list) or not data:
        raise ValueError(f"PSX endpoint returned no data for {benchmark_name}")

    return data


def parse_row(benchmark_name: str, row: list[object]) -> dict[str, str]:
    if len(row) < 4:
        raise ValueError(f"Expected at least 4 values in {benchmark_name} row, got {row}")

    epoch_seconds = int(row[0])
    date_value = datetime.fromtimestamp(epoch_seconds, tz=timezone.utc).date().isoformat()

    return {
        "date": date_value,
        "benchmark_name": benchmark_name,
        "index_level": format_decimal(Decimal(str(row[1]))),
        "volume": str(int(row[2])),
        "open_candidate": format_decimal(Decimal(str(row[3]))),
    }


def validate_records(records: list[dict[str, str]]) -> None:
    seen_keys: set[tuple[str, str]] = set()
    for record in records:
        key = (record["date"], record["benchmark_name"])
        if key in seen_keys:
            raise ValueError(f"Duplicate benchmark record for {key}")
        seen_keys.add(key)

        index_level = Decimal(record["index_level"])
        open_candidate = Decimal(record["open_candidate"])
        volume = int(record["volume"])

        if index_level <= 0:
            raise ValueError(f"Non-positive index_level for {key}: {index_level}")
        if open_candidate <= 0:
            raise ValueError(f"Non-positive open_candidate for {key}: {open_candidate}")
        if volume < 0:
            raise ValueError(f"Negative volume for {key}: {volume}")


def collect_records(session: requests.Session, benchmarks: list[str]) -> tuple[list[dict[str, str]], int]:
    records_by_key: dict[tuple[str, str], dict[str, str]] = {}
    duplicate_rows_skipped = 0

    for benchmark_name in benchmarks:
        data = fetch_timeseries(session, benchmark_name)
        for row in data:
            record = parse_row(benchmark_name, row)
            key = (record["date"], record["benchmark_name"])
            existing_record = records_by_key.get(key)
            if existing_record is not None:
                if existing_record != record:
                    raise ValueError(f"Conflicting duplicate benchmark record for {key}")
                duplicate_rows_skipped += 1
                continue
            records_by_key[key] = record

    records = list(records_by_key.values())
    records.sort(key=lambda item: (item["date"], item["benchmark_name"]))
    validate_records(records)
    return records, duplicate_rows_skipped


def write_csv(records: Iterable[dict[str, str]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(records)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Scrape PSX benchmark history into benchmark_daily.csv.")
    parser.add_argument(
        "--benchmarks",
        nargs="+",
        choices=sorted(BENCHMARK_ENDPOINTS),
        default=sorted(BENCHMARK_ENDPOINTS),
        help="Benchmark symbols to fetch. Defaults to KMI30, KSE30, and KSE100.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output CSV path. Defaults to benchmark_daily.csv in the current directory.",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()

    with build_session() as session:
        records, duplicate_rows_skipped = collect_records(session, args.benchmarks)

    write_csv(records, args.output)
    print(
        f"Wrote {len(records)} rows to {args.output} for benchmarks: {', '.join(args.benchmarks)} "
        f"(skipped {duplicate_rows_skipped} exact duplicate rows)"
    )


if __name__ == "__main__":
    main()