from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import Iterable
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag


SOURCE_URL = "https://www.mufap.com.pk/FundProfile/FundDirectory"
DEFAULT_OUTPUT = Path("fund_directory.csv")
FIELDNAMES = [
    "fund_name",
    "fund_id",
    "amc_name",
    "category",
    "fund_type",
    "risk_profile",
    "nav",
    "offer_price",
    "shariah_flag",
]


def clean_text(value: str) -> str:
    return " ".join(value.split())


def parse_float(value: str) -> float | None:
    cleaned = clean_text(value).replace(",", "")
    if not cleaned:
        return None
    return float(cleaned)


def format_float(value: float | None) -> str:
    if value is None:
        return ""
    return f"{value:.2f}"


def parse_fund_id(href: str) -> str:
    parsed_url = urlparse(urljoin(SOURCE_URL, href))
    fund_ids = parse_qs(parsed_url.query).get("FundID", [])
    if not fund_ids:
        raise ValueError(f"Could not find FundID in href: {href}")
    return fund_ids[0]


def extract_metric_map(row: Tag) -> dict[str, str]:
    metric_map: dict[str, str] = {}
    for block in row.select("div.row.investmentCard > div"):
        parts = [clean_text(text) for text in block.stripped_strings if clean_text(text)]
        if len(parts) < 2:
            continue

        label = parts[-1]
        value = " ".join(parts[:-1]).strip()
        metric_map[label] = value

    return metric_map


def parse_row(row: Tag) -> dict[str, str]:
    cells = row.find_all("td", recursive=False)
    if len(cells) < 4:
        raise ValueError("Expected at least 4 td cells in fund row")

    fund_name_tag = row.select_one("h3.card-title")
    fund_detail_link = row.select_one('a[href*="FundDetail?FundID="]')
    amc_name_tag = row.select_one("div.text-left span")

    if fund_name_tag is None or fund_detail_link is None or amc_name_tag is None:
        raise ValueError("Fund row is missing one or more required elements")

    metrics = extract_metric_map(row)
    category = metrics.get("Category") or clean_text(cells[3].get_text(" ", strip=True))
    risk_profile = metrics.get("Risk Profile", "")
    shariah_flag = category.startswith("Shariah Compliant") or category.startswith("VPS-Shariah")

    return {
        "fund_name": clean_text(fund_name_tag.get_text(" ", strip=True)),
        "fund_id": parse_fund_id(fund_detail_link.get("href", "")),
        "amc_name": clean_text(amc_name_tag.get_text(" ", strip=True)),
        "category": category,
        "fund_type": clean_text(cells[1].get_text(" ", strip=True)),
        "risk_profile": risk_profile,
        "nav": format_float(parse_float(metrics.get("NAV", ""))),
        "offer_price": format_float(parse_float(metrics.get("Offer Price", ""))),
        "shariah_flag": "true" if shariah_flag else "false",
    }


def parse_directory(html: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    rows = soup.select("#table_id tbody tr.fund-block")
    records = [parse_row(row) for row in rows]

    if not records:
        raise ValueError("No fund rows found in MUFAP Fund Directory HTML")

    fund_ids = [record["fund_id"] for record in records]
    if len(fund_ids) != len(set(fund_ids)):
        raise ValueError("Duplicate fund_id values found in scraped output")

    return records


def fetch_directory_html(session: requests.Session) -> str:
    response = session.get(
        SOURCE_URL,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
        },
        timeout=60,
    )
    response.raise_for_status()
    return response.text


def write_csv(records: Iterable[dict[str, str]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(records)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Scrape the MUFAP fund directory into CSV.")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output CSV path. Defaults to fund_directory.csv in the current directory.",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    with requests.Session() as session:
        html = fetch_directory_html(session)

    records = parse_directory(html)
    write_csv(records, args.output)
    print(f"Wrote {len(records)} funds to {args.output}")


if __name__ == "__main__":
    main()