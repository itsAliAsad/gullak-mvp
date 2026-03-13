from __future__ import annotations

import argparse
import csv
import json
import time
from datetime import date, datetime, timezone
from pathlib import Path

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


API_URL = "https://www.mufap.com.pk/AMC/GetFundDetailbyAMCByDate"
DEFAULT_DIRECTORY = Path("fund_directory.csv")
DEFAULT_OUTPUT = Path("fund_returns.csv")
DEFAULT_DELAY = 1.0

FIELDNAMES = [
    "fund_id",
    "fund_name",
    "scraped_at",
    "return_ytd",
    "return_mtd",
    "return_1m",
    "return_3m",
    "return_6m",
    "return_9m",
    "return_1y",
    "return_2y",
    "return_3y",
]

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
)


def pct_to_decimal(value: float | None) -> str:
    """Convert a percentage like 14.09 to a decimal string '0.1409'."""
    if value is None:
        return ""
    return str(round(value / 100.0, 6))


def build_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=5,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["POST"],
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json;charset=utf-8",
        "Referer": "https://www.mufap.com.pk/FundProfile/FundDetail",
    })
    return session


def fetch_fund_returns(session: requests.Session, fund_id: str, as_of_month: str) -> dict[str, str] | None:
    """
    POST to the MUFAP fund detail API and extract Table4 (returns).

    as_of_month must be in YYYY-MM-01 format (first day of current month),
    which is what the MUFAP frontend sends.

    Returns a dict of field_name -> decimal string, or None if Table4 is missing.
    """
    payload = json.dumps({"FundID": fund_id, "Date": as_of_month})
    response = session.post(API_URL, data=payload, timeout=30)
    response.raise_for_status()

    outer = response.json()
    inner = json.loads(outer["data"])
    table4 = inner.get("Table4")
    if not table4:
        return None

    row = table4[0]
    return {
        "return_ytd": pct_to_decimal(row.get("YTD")),
        "return_mtd": pct_to_decimal(row.get("MTD")),
        "return_1m":  pct_to_decimal(row.get("Day30")),
        "return_3m":  pct_to_decimal(row.get("Day90")),
        "return_6m":  pct_to_decimal(row.get("Day180")),
        "return_9m":  pct_to_decimal(row.get("Day270")),
        "return_1y":  pct_to_decimal(row.get("Year1")),
        "return_2y":  pct_to_decimal(row.get("Year2")),
        "return_3y":  pct_to_decimal(row.get("Year3")),
    }


def load_directory_funds(directory_path: Path) -> list[tuple[str, str]]:
    if not directory_path.exists():
        raise FileNotFoundError(
            f"Directory file not found: {directory_path}. Run scrape_fund_directory.py first."
        )
    with directory_path.open("r", newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        return [(row["fund_id"], row["fund_name"].strip()) for row in reader]


def load_existing_fund_ids(output_path: Path) -> set[str]:
    if not output_path.exists():
        return set()
    with output_path.open("r", newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        return {row["fund_id"] for row in reader}


def build_parser() -> argparse.ArgumentParser:
    today = date.today()
    default_month = f"{today.year}-{today.month:02d}-01"

    parser = argparse.ArgumentParser(
        description="Scrape MUFAP fund return figures into fund_returns.csv."
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
        help="Output CSV path. Defaults to fund_returns.csv.",
    )
    parser.add_argument(
        "--as-of-month",
        default=default_month,
        help=f"YYYY-MM-01 month for the API query. Defaults to {default_month}.",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY,
        help="Seconds to wait between requests. Defaults to 1.0.",
    )
    parser.add_argument(
        "--fund-ids",
        nargs="+",
        metavar="FUND_ID",
        help="Only scrape these fund IDs (space-separated). Useful for testing.",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Skip fund IDs already present in the output file.",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()

    all_funds = load_directory_funds(args.directory_file)

    if args.fund_ids:
        filter_set = set(args.fund_ids)
        funds = [(fid, fname) for fid, fname in all_funds if fid in filter_set]
        missing = filter_set - {fid for fid, _ in funds}
        if missing:
            raise ValueError(f"Fund IDs not found in directory: {sorted(missing)}")
    else:
        funds = all_funds

    if args.resume:
        existing_ids = load_existing_fund_ids(args.output)
        before = len(funds)
        funds = [(fid, fname) for fid, fname in funds if fid not in existing_ids]
        print(f"Resume mode: skipping {before - len(funds)} already-scraped funds.")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    open_mode = "a" if args.resume and args.output.exists() else "w"
    write_header = open_mode == "w" or not args.output.exists()

    scraped = 0
    missing_returns = 0

    with args.output.open(open_mode, newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=FIELDNAMES)
        if write_header:
            writer.writeheader()

        with build_session() as session:
            for i, (fund_id, fund_name) in enumerate(funds):
                if i > 0:
                    time.sleep(args.delay)

                try:
                    returns = fetch_fund_returns(session, fund_id, args.as_of_month)
                except requests.RequestException as exc:
                    print(f"  ERROR {fund_id} ({fund_name}): {exc}")
                    continue
                except (KeyError, ValueError, json.JSONDecodeError) as exc:
                    print(f"  PARSE ERROR {fund_id} ({fund_name}): {exc}")
                    continue

                if returns is None:
                    missing_returns += 1
                    print(f"  WARN  {fund_id} ({fund_name}): no Table4 in response")
                    returns = {}

                row = {
                    "fund_id": fund_id,
                    "fund_name": fund_name,
                    "scraped_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
                    **{field: returns.get(field, "") for field in FIELDNAMES[3:]},
                }
                writer.writerow(row)
                csv_file.flush()
                scraped += 1

                non_empty = {k: v for k, v in returns.items() if v}
                print(
                    f"[{scraped}/{len(funds)}] {fund_id} {fund_name}: "
                    + ", ".join(f"{k}={v}" for k, v in non_empty.items())
                )

    print(
        f"\nDone. Scraped {scraped} funds to {args.output}. "
        f"No returns data: {missing_returns}."
    )


if __name__ == "__main__":
    main()
