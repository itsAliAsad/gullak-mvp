from __future__ import annotations

import argparse
import csv
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Iterable
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


SOURCE_URL = "https://www.mufap.com.pk/Industry/IndustryStatDaily"
DEFAULT_OUTPUT = Path("nav_daily.csv")
DEFAULT_DIRECTORY = Path("fund_directory.csv")
LOOKBACK_DAYS = 10
FIELDNAMES = [
    "date",
    "fund_id",
    "fund_name",
    "nav",
    "offer_price",
    "redemption_price",
    "front_end_load",
]
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
)


def clean_text(value: str) -> str:
    return " ".join(value.split())


def format_decimal(value: Decimal | None) -> str:
    if value is None:
        return ""
    return format(value, ".4f")


def parse_decimal(value: str) -> Decimal | None:
    cleaned = clean_text(value).replace(",", "")
    if not cleaned:
        return None
    return Decimal(cleaned)


def parse_iso_date(value: str) -> str:
    return datetime.strptime(clean_text(value), "%b %d, %Y").date().isoformat()


def parse_fund_id(href: str) -> str:
    parsed_url = urlparse(urljoin(SOURCE_URL, href))
    fund_ids = parse_qs(parsed_url.query).get("FundID", [])
    if not fund_ids:
        raise ValueError(f"Could not find FundID in href: {href}")
    return fund_ids[0]


def subtract_years(day: date, years: int) -> date:
    try:
        return day.replace(year=day.year - years)
    except ValueError:
        return day.replace(month=2, day=28, year=day.year - years)


def chunk_date_ranges(start_date: date, end_date: date, chunk_days: int) -> Iterable[tuple[date, date]]:
    current_start = start_date
    while current_start <= end_date:
        current_end = min(current_start + timedelta(days=chunk_days - 1), end_date)
        yield current_start, current_end
        current_start = current_end + timedelta(days=1)


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


def fetch_nav_html(session: requests.Session, start_date: date, end_date: date) -> str:
    response = session.get(
        SOURCE_URL,
        params={
            "tab": 3,
            "AMCId": "null",
            "fundId": "null",
            "datefrom": start_date.isoformat(),
            "datetill": end_date.isoformat(),
        },
        timeout=120,
    )
    response.raise_for_status()
    return response.text


def load_directory_funds(directory_path: Path) -> dict[str, str]:
    if not directory_path.exists():
        raise FileNotFoundError(
            f"Directory file not found at {directory_path}. Run scrape_fund_directory.py first."
        )

    with directory_path.open("r", newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        funds_by_id = {row["fund_id"]: clean_text(row["fund_name"]) for row in reader}

    if not funds_by_id:
        raise ValueError(f"No funds found in directory file: {directory_path}")

    return funds_by_id


def parse_nav_row(row: Tag, directory_funds: dict[str, str]) -> tuple[tuple[str, str], dict[str, str]] | None:
    cells = row.find_all("td", recursive=False)
    if len(cells) < 14:
        raise ValueError("Expected at least 14 td cells in NAV row")

    validity_date = clean_text(cells[8].get_text(" ", strip=True))
    if not validity_date:
        return None

    fund_link = row.select_one('a[href*="FundDetail?FundID="]')
    if fund_link is None:
        raise ValueError("NAV row is missing fund detail link")

    fund_id = parse_fund_id(fund_link.get("href", ""))
    if fund_id not in directory_funds:
        raise ValueError(f"FundID {fund_id} from NAV page was not found in fund_directory.csv")

    page_fund_name = clean_text(fund_link.get_text(" ", strip=True))
    directory_fund_name = directory_funds[fund_id]
    if page_fund_name != directory_fund_name:
        raise ValueError(
            f"Fund name mismatch for FundID {fund_id}: page='{page_fund_name}' directory='{directory_fund_name}'"
        )

    record = {
        "date": parse_iso_date(validity_date),
        "fund_id": fund_id,
        "fund_name": directory_fund_name,
        "nav": format_decimal(parse_decimal(cells[7].get_text(" ", strip=True))),
        "offer_price": format_decimal(parse_decimal(cells[5].get_text(" ", strip=True))),
        "redemption_price": format_decimal(parse_decimal(cells[6].get_text(" ", strip=True))),
        "front_end_load": format_decimal(parse_decimal(cells[9].get_text(" ", strip=True))),
    }
    return (record["date"], fund_id), record


def parse_nav_html(html: str, directory_funds: dict[str, str]) -> tuple[list[tuple[tuple[str, str], dict[str, str]]], int]:
    soup = BeautifulSoup(html, "html.parser")
    rows = soup.select("#table_id tbody tr.fund-block")
    if not rows:
        raise ValueError("No NAV rows found in MUFAP NAV HTML")

    records: list[tuple[tuple[str, str], dict[str, str]]] = []
    skipped_blank_dates = 0
    for row in rows:
        parsed = parse_nav_row(row, directory_funds)
        if parsed is None:
            skipped_blank_dates += 1
            continue
        records.append(parsed)

    return records, skipped_blank_dates


def write_csv(records: Iterable[dict[str, str]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(records)


def infer_trading_dates(records_by_key: dict[tuple[str, str], dict[str, str]]) -> set[str]:
    snapshots_by_date: dict[str, dict[str, tuple[str, str, str, str]]] = {}
    for (record_date, fund_id), record in records_by_key.items():
        snapshots_by_date.setdefault(record_date, {})[fund_id] = (
            record["nav"],
            record["offer_price"],
            record["redemption_price"],
            record["front_end_load"],
        )

    trading_dates: set[str] = set()
    previous_snapshot: dict[str, tuple[str, str, str, str]] | None = None
    for record_date in sorted(snapshots_by_date):
        current_snapshot = snapshots_by_date[record_date]
        current_day = date.fromisoformat(record_date)
        if current_day.weekday() < 5 and current_snapshot != previous_snapshot:
            trading_dates.add(record_date)
        previous_snapshot = current_snapshot

    return trading_dates


def build_parser() -> argparse.ArgumentParser:
    today = date.today()
    default_start = subtract_years(today, 3)

    parser = argparse.ArgumentParser(description="Scrape MUFAP NAV history into nav_daily.csv.")
    parser.add_argument(
        "--start-date",
        default=default_start.isoformat(),
        help="Inclusive start date in YYYY-MM-DD format. Defaults to three years before today.",
    )
    parser.add_argument(
        "--end-date",
        default=today.isoformat(),
        help="Inclusive end date in YYYY-MM-DD format. Defaults to today.",
    )
    parser.add_argument(
        "--chunk-days",
        type=int,
        default=31,
        help="Number of calendar days per request chunk. Defaults to 31.",
    )
    parser.add_argument(
        "--directory-file",
        type=Path,
        default=DEFAULT_DIRECTORY,
        help="Path to fund_directory.csv for FundID validation.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output CSV path. Defaults to nav_daily.csv in the current directory.",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    start_date = date.fromisoformat(args.start_date)
    end_date = date.fromisoformat(args.end_date)
    if start_date > end_date:
        raise ValueError("start-date must be on or before end-date")
    if args.chunk_days < 1:
        raise ValueError("chunk-days must be at least 1")

    directory_funds = load_directory_funds(args.directory_file)
    records_by_key: dict[tuple[str, str], dict[str, str]] = {}
    skipped_blank_dates = 0
    fetch_start_date = start_date - timedelta(days=LOOKBACK_DAYS)

    with build_session() as session:
        for chunk_start, chunk_end in chunk_date_ranges(fetch_start_date, end_date, args.chunk_days):
            html = fetch_nav_html(session, chunk_start, chunk_end)
            chunk_records, chunk_skipped = parse_nav_html(html, directory_funds)
            skipped_blank_dates += chunk_skipped

            for key, record in chunk_records:
                existing_record = records_by_key.get(key)
                if existing_record is not None and existing_record != record:
                    raise ValueError(f"Conflicting duplicate record for key {key}")
                records_by_key[key] = record

            print(
                f"Fetched {chunk_start.isoformat()} to {chunk_end.isoformat()}: "
                f"{len(chunk_records)} rows, skipped {chunk_skipped} blank-date rows"
            )

    trading_dates = infer_trading_dates(records_by_key)
    sorted_records = [
        records_by_key[key]
        for key in sorted(records_by_key, key=lambda item: (item[0], records_by_key[item]["fund_name"], item[1]))
        if start_date.isoformat() <= key[0] <= end_date.isoformat() and key[0] in trading_dates
    ]
    write_csv(sorted_records, args.output)
    print(
        f"Wrote {len(sorted_records)} rows to {args.output} "
        f"(skipped {skipped_blank_dates} rows with no validity date; kept {len(trading_dates)} inferred trading dates)"
    )


if __name__ == "__main__":
    main()