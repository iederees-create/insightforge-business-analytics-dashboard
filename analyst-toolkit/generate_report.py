"""Generate a single self-contained HTML summary report from cleaned data.

Reads orders (and, if present, reviews) from sample_data/, cleans them with
clean_data.clean_dataframe, then writes KPIs, top products, an RFM segment
summary, and a simple forecast summary to output/report.html.

Run directly:

    python generate_report.py [path/to/orders.csv]

No external API calls are made; everything here is computed locally from
the CSV(s) on disk.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime

import numpy as np
import pandas as pd

from analysis_utils import compute_rfm, forecast_linear_trend
from clean_data import clean_dataframe, load_csv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ORDERS_PATH = os.path.join(BASE_DIR, "sample_data", "orders.csv")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
REPORT_PATH = os.path.join(OUTPUT_DIR, "report.html")
FORECAST_HORIZON_DAYS = 30


def _kpi_section(orders: pd.DataFrame) -> str:
    total_orders = len(orders)
    total_revenue = orders["revenue"].sum() if "revenue" in orders.columns else None
    total_profit = orders["profit"].sum() if "profit" in orders.columns else None
    aov = (total_revenue / total_orders) if total_revenue is not None and total_orders else None
    margin_pct = (
        (total_profit / total_revenue * 100) if total_profit is not None and total_revenue not in (None, 0) else None
    )

    def fmt_money(value: float | None) -> str:
        return f"${value:,.2f}" if value is not None else "unavailable (column missing)"

    def fmt_pct(value: float | None) -> str:
        return f"{value:.1f}%" if value is not None else "unavailable (column missing)"

    return f"""
    <section>
      <h2>Key Performance Indicators</h2>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">Total Orders</div><div class="kpi-value">{total_orders:,}</div></div>
        <div class="kpi"><div class="kpi-label">Total Revenue</div><div class="kpi-value">{fmt_money(total_revenue)}</div></div>
        <div class="kpi"><div class="kpi-label">Average Order Value</div><div class="kpi-value">{fmt_money(aov)}</div></div>
        <div class="kpi"><div class="kpi-label">Profit Margin</div><div class="kpi-value">{fmt_pct(margin_pct)}</div></div>
      </div>
    </section>
    """


def _top_products_section(orders: pd.DataFrame, top_n: int = 10) -> str:
    if "product" not in orders.columns or "revenue" not in orders.columns:
        return "<section><h2>Top Products</h2><p>Unavailable: 'product' or 'revenue' column not present in this dataset.</p></section>"

    top = (
        orders.groupby("product")["revenue"]
        .sum()
        .sort_values(ascending=False)
        .head(top_n)
        .reset_index()
    )
    rows = "".join(f"<tr><td>{r.product}</td><td>${r.revenue:,.2f}</td></tr>" for r in top.itertuples())
    return f"""
    <section>
      <h2>Top {top_n} Products by Revenue</h2>
      <table><thead><tr><th>Product</th><th>Revenue</th></tr></thead><tbody>{rows}</tbody></table>
    </section>
    """


def _segment_summary_section(orders: pd.DataFrame) -> str:
    required = {"customerId", "date", "revenue"}
    if not required.issubset(orders.columns):
        missing = required - set(orders.columns)
        return f"<section><h2>Customer Segments (RFM)</h2><p>Unavailable: missing column(s) {sorted(missing)}.</p></section>"

    rfm = compute_rfm(orders)
    summary = rfm.groupby("segment").agg(customers=("customerId", "count"), totalRevenue=("monetary", "sum"))
    summary = summary.sort_values("totalRevenue", ascending=False).reset_index()
    rows = "".join(
        f"<tr><td>{r.segment}</td><td>{r.customers:,}</td><td>${r.totalRevenue:,.2f}</td></tr>"
        for r in summary.itertuples()
    )
    return f"""
    <section>
      <h2>Customer Segments (RFM)</h2>
      <table><thead><tr><th>Segment</th><th>Customers</th><th>Total Revenue</th></tr></thead><tbody>{rows}</tbody></table>
    </section>
    """


def _forecast_summary_section(orders: pd.DataFrame) -> str:
    if "date" not in orders.columns or "revenue" not in orders.columns:
        return "<section><h2>Revenue Forecast</h2><p>Unavailable: 'date' or 'revenue' column not present in this dataset.</p></section>"

    daily = orders.copy()
    daily["date"] = pd.to_datetime(daily["date"])
    daily_revenue = daily.groupby("date")["revenue"].sum().sort_index()
    if len(daily_revenue) < 2:
        return "<section><h2>Revenue Forecast</h2><p>Unavailable: not enough daily history to fit a trend.</p></section>"

    day_offsets = (daily_revenue.index - daily_revenue.index.min()).days.to_numpy()
    _trend, future_x, forecast_y = forecast_linear_trend(day_offsets, daily_revenue.to_numpy(), FORECAST_HORIZON_DAYS)
    projected_total = float(np.sum(forecast_y))

    return f"""
    <section>
      <h2>Revenue Forecast (Next {FORECAST_HORIZON_DAYS} Days)</h2>
      <p>Simple linear-trend extrapolation of daily revenue. Projected total for the
      next {FORECAST_HORIZON_DAYS} days: <strong>${projected_total:,.2f}</strong>.</p>
      <p class="caveat">This is a transparent trend extrapolation, not a guarantee of
      future results. See notebooks/04_forecasting.ipynb for methodology and limitations.</p>
    </section>
    """


def build_report_html(orders: pd.DataFrame, cleaning_summary: str) -> str:
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>InsightForge Business Analytics — Summary Report</title>
<style>
  body {{ font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 2rem; color: #1a1a2e; background: #f7f7fb; }}
  h1 {{ margin-bottom: 0.2rem; }}
  .subtitle {{ color: #666; margin-top: 0; }}
  section {{ background: #fff; border-radius: 10px; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }}
  .kpi-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; }}
  .kpi {{ background: #f0f2fa; border-radius: 8px; padding: 0.75rem 1rem; }}
  .kpi-label {{ font-size: 0.8rem; color: #555; text-transform: uppercase; letter-spacing: 0.03em; }}
  .kpi-value {{ font-size: 1.5rem; font-weight: 700; }}
  table {{ border-collapse: collapse; width: 100%; }}
  th, td {{ text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #eee; }}
  th {{ background: #f0f2fa; }}
  .caveat {{ color: #7a5c00; background: #fff8e1; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.9rem; }}
  pre {{ white-space: pre-wrap; font-size: 0.85rem; background: #f0f2fa; padding: 1rem; border-radius: 8px; }}
  footer {{ color: #888; font-size: 0.8rem; margin-top: 2rem; }}
</style>
</head>
<body>
  <h1>InsightForge Business Analytics — Summary Report</h1>
  <p class="subtitle">Generated {generated_at} by generate_report.py (analyst toolkit). Data is synthetic sample data unless a real export was provided.</p>

  {_kpi_section(orders)}
  {_top_products_section(orders)}
  {_segment_summary_section(orders)}
  {_forecast_summary_section(orders)}

  <section>
    <h2>Data Cleaning Notes</h2>
    <pre>{cleaning_summary}</pre>
  </section>

  <footer>InsightForge Business Analytics Studio — Python Analyst Toolkit. No external API calls were made to generate this report.</footer>
</body>
</html>
"""


def main(argv: list[str]) -> int:
    orders_path = argv[1] if len(argv) > 1 else DEFAULT_ORDERS_PATH
    if not os.path.exists(orders_path):
        print(f"Error: orders file not found at {orders_path}. Run 'python data_generator.py' first.")
        return 1

    raw_orders = load_csv(orders_path)
    cleaned_orders, cleaning_summary = clean_dataframe(raw_orders)

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    html = build_report_html(cleaned_orders, cleaning_summary)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"Report written to {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
