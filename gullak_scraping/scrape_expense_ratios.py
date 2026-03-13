from __future__ import annotations

import argparse
import csv
from decimal import Decimal
from pathlib import Path
from typing import Iterable
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


SOURCE_URL = "https://www.mufap.com.pk/Industry/IndustryStatDaily"
DEFAULT_OUTPUT = Path("expense_ratios.csv")
DEFAULT_DIRECTORY = Path("fund_directory.csv")
FIELDNAMES = ["fund_name", "expense_ratio_pct"]
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
)
TER_CELL_INDEX = {
    "mtd": 6,
    "ytd": 7,
}


def clean_text(value: str) -> str:
    return " ".join(value.split())


def parse_decimal(value: str) -> Decimal | None:
    cleaned = clean_text(value).replace(",", "")
    if not cleaned:
        return None
    return Decimal(cleaned)


def format_decimal(value: Decimal | None) -> str:
    if value is None:
        return ""
    return format(value, ".2f")


def parse_fund_id(href: str) -> str:
    parsed_url = urlparse(urljoin(SOURCE_URL, href))
    fund_ids = parse_qs(parsed_url.query).get("FundID", [])
    if not fund_ids:
        raise ValueError(f"Could not find FundID in href: {href}")
    return fund_ids[0]


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


def fetch_expense_ratio_html(session: requests.Session) -> str:
    response = session.get(
        SOURCE_URL,
        params={"tab": 5},
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


def parse_expense_ratio_row(
    row: Tag,
    directory_funds: dict[str, str],
    ratio_field: str,
) -> tuple[str, dict[str, str]]:
    cells = row.find_all("td", recursive=False)
    if len(cells) < 11:
        raise ValueError("Expected at least 11 td cells in expense ratio row")

    fund_link = row.select_one('a[href*="FundDetail?FundID="]')
    if fund_link is None:
        raise ValueError("Expense ratio row is missing fund detail link")

    fund_id = parse_fund_id(fund_link.get("href", ""))
    if fund_id not in directory_funds:
        raise ValueError(f"FundID {fund_id} from expense ratio page was not found in fund_directory.csv")

    page_fund_name = clean_text(fund_link.get_text(" ", strip=True))
    directory_fund_name = directory_funds[fund_id]
    if page_fund_name != directory_fund_name:
        raise ValueError(
            f"Fund name mismatch for FundID {fund_id}: page='{page_fund_name}' directory='{directory_fund_name}'"
        )

    ratio_value = parse_decimal(cells[TER_CELL_INDEX[ratio_field]].get_text(" ", strip=True))
    if ratio_value is None:
        raise ValueError(f"Missing TER {ratio_field.upper()} value for FundID {fund_id}")

    record = {
        "fund_name": directory_fund_name,
        "expense_ratio_pct": format_decimal(ratio_value),
    }
    return fund_id, record


def parse_expense_ratio_html(
    html: str,
    directory_funds: dict[str, str],
    ratio_field: str,
) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    rows = soup.select("#table_id tbody tr.fund-block")
    if not rows:
        raise ValueError("No expense ratio rows found in MUFAP expense ratio HTML")

    records_by_fund_id: dict[str, dict[str, str]] = {}
    for row in rows:
        fund_id, record = parse_expense_ratio_row(row, directory_funds, ratio_field)
        existing_record = records_by_fund_id.get(fund_id)
        if existing_record is not None and existing_record != record:
            raise ValueError(f"Conflicting duplicate record for FundID {fund_id}")
        records_by_fund_id[fund_id] = record

    return [records_by_fund_id[fund_id] for fund_id in sorted(records_by_fund_id, key=lambda item: records_by_fund_id[item]["fund_name"])]


def write_csv(records: Iterable[dict[str, str]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(records)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Scrape MUFAP expense ratios into expense_ratios.csv.")
    parser.add_argument(
        "--directory-file",
        type=Path,
        default=DEFAULT_DIRECTORY,
        help="Path to fund_directory.csv for FundID validation.",
    )
    parser.add_argument(
        "--ratio-field",
        choices=sorted(TER_CELL_INDEX),
        default="ytd",
        help="Which TER field to export as expense_ratio_pct. Defaults to ytd.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output CSV path. Defaults to expense_ratios.csv in the current directory.",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    directory_funds = load_directory_funds(args.directory_file)

    with build_session() as session:
        html = fetch_expense_ratio_html(session)

    records = parse_expense_ratio_html(html, directory_funds, args.ratio_field)
    write_csv(records, args.output)
    print(
        f"Wrote {len(records)} rows to {args.output} using TER {args.ratio_field.upper()} as expense_ratio_pct"
    )


if __name__ == "__main__":
    main()