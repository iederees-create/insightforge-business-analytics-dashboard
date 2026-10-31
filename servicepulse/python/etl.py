"""PulseBI reproducible offline analytics ETL for ServicePulse SA.

No third-party dependencies, credentials, network access, or personal data exports.
Usage: python servicepulse/python/etl.py --input path/to/leads.csv --out ./reports
CSV: date,client,service,source,status,quote_amount,cost_amount
All currency amounts are ZAR; sample records are fictional, not sales evidence.
"""
from __future__ import annotations
import argparse
import csv
import json
import re
from collections import defaultdict
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

REQUIRED = ("date", "client", "service", "source", "status", "quote_amount", "cost_amount")
STATUSES = {"new", "quoted", "won", "lost"}

def parse_money(value: str) -> Decimal:
    """Parse two-decimal ZAR safely; reject negative and nonfinite values."""
    try:
        n = Decimal(value)
        if not n.is_finite() or n < 0 or n.as_tuple().exponent < -2:
            raise ValueError("invalid amount")
        return n.quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"invalid currency amount: {value!r}") from exc

def normalize(row: dict[str, str], line: int) -> dict:
    missing = [f for f in REQUIRED if f not in row]
    if missing:
        raise ValueError(f"line {line}: missing columns {missing}")
    value_date = (row["date"] or "").strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value_date):
        raise ValueError(f"line {line}: expected YYYY-MM-DD date")
    try:
        date.fromisoformat(value_date)
    except ValueError as exc:
        raise ValueError(f"line {line}: invalid date") from exc
    status = (row["status"] or "").lower().strip()
    if status not in STATUSES:
        raise ValueError(f"line {line}: invalid status {status!r}")
    out = {f: (row[f] or "").strip() for f in ("client", "service", "source")}
    if not all(out.values()):
        raise ValueError(f"line {line}: blank client, service, or source")
    out.update(date=value_date, status=status,
               quote_amount=parse_money(row["quote_amount"]),
               cost_amount=parse_money(row["cost_amount"]))
    return out

def load(path: Path) -> list[dict]:
    if path.stat().st_size > 2_000_000:
        raise ValueError("input file exceeds 2 MB")
    with path.open(newline="", encoding="utf-8-sig") as fp:
        reader = csv.DictReader(fp)
        if not reader.fieldnames or any(field not in reader.fieldnames for field in REQUIRED):
            raise ValueError("CSV missing required headers")
        rows = [normalize(row, i) for i, row in enumerate(reader, 2)]
    if len(rows) > 5000:
        raise ValueError("too many rows")
    return rows

def aggregate(rows: list[dict]) -> dict:
    won = [r for r in rows if r["status"] == "won"]
    lost = [r for r in rows if r["status"] == "lost"]
    decisions = len(won) + len(lost)
    won_value = sum((r["quote_amount"] for r in won), Decimal(0))
    won_cost = sum((r["cost_amount"] for r in won), Decimal(0))
    source_stats = defaultdict(lambda: {"won_count": 0, "won_value": Decimal(0)})
    by_month = defaultdict(lambda: {"won_count": 0, "won_value": Decimal(0)})
    for row in won:
        ss = source_stats[row["source"].lower()]
        ss["won_count"] += 1
        ss["won_value"] += row["quote_amount"]
        ms = by_month[row["date"][:7]]
        ms["won_count"] += 1
        ms["won_value"] += row["quote_amount"]
    return {
        "data_kind": "uploaded_or_simulated_quote_data_not_settled_payments",
        "row_count": len(rows),
        "won_count": len(won),
        "lost_count": len(lost),
        "win_rate_pct": round(len(won) / decisions * 100, 2) if decisions else None,
        "won_quote_value_zar": str(won_value),
        "estimated_gross_profit_zar": str(won_value - won_cost),
        "source_performance": {k: {"won_count": v["won_count"], "won_value_zar": str(v["won_value"])}
                               for k, v in sorted(source_stats.items())},
        "monthly_performance": {k: {"won_count": v["won_count"], "won_value_zar": str(v["won_value"])}
                                for k, v in sorted(by_month.items())},
    }

def run(input_path: Path, output_dir: Path) -> Path:
    metrics = aggregate(load(input_path))
    output_dir.mkdir(parents=True, exist_ok=True)
    result = output_dir / "summary.json"
    result.write_text(json.dumps(metrics, indent=2) + "\n", encoding="utf-8")
    return result

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", required=True, type=Path)
    p.add_argument("--out", default=Path("reports"), type=Path)
    args = p.parse_args()
    print(run(args.input, args.out))
