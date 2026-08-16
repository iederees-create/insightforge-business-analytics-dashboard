"""Task 5: calculate_metrics - KPIs and RFM-style segmentation.

Deliberately mirrors two files in the browser dashboard so "compatible with
the existing dashboard" is a checkable claim, not marketing copy:
  - src/lib/metrics/kpis.ts        -> KPI formulas below
  - src/lib/metrics/segmentation.ts -> segmentation thresholds/logic below
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from transforms.io_utils import atomic_write_json
from transforms.logging_utils import get_logger

logger = get_logger("metrics")

# Mirrors DEFAULT_SEGMENTATION_THRESHOLDS in src/lib/metrics/segmentation.ts.
LOYAL_ORDER_COUNT = 4
HIGH_VALUE_REVENUE = 500.0
AT_RISK_DAYS = 90
INACTIVE_DAYS = 180


def _classify_segment(frequency: int, monetary: float, recency_days: float) -> str:
    if recency_days >= INACTIVE_DAYS:
        return "Inactive"
    if monetary >= HIGH_VALUE_REVENUE:
        return "High Value"
    if recency_days >= AT_RISK_DAYS:
        return "At Risk"
    if frequency >= LOYAL_ORDER_COUNT:
        return "Loyal"
    if frequency > 1:
        return "Repeat"
    return "New"


def _rank_by(df: pd.DataFrame, field: str) -> list[dict]:
    if field not in df.columns:
        return []
    working = df.dropna(subset=[field]).copy()
    for optional_col in ("quantity", "profit"):
        if optional_col not in working.columns:
            working[optional_col] = 0.0
    grouped = (
        working.groupby(field)
        .agg(revenue=("revenue", "sum"), quantity=("quantity", "sum"), profit=("profit", "sum"), orders=("orderId", "count"))
        .reset_index()
        .rename(columns={field: "label"})
        .sort_values("revenue", ascending=False)
    )
    return grouped.to_dict(orient="records")


def _compute_kpis(df: pd.DataFrame) -> dict:
    revenue_total = float(df["revenue"].sum(skipna=True))
    orders = int(df["orderId"].nunique()) if "orderId" in df.columns else len(df)
    units_total = float(df["quantity"].sum(skipna=True)) if "quantity" in df.columns else 0.0
    cost_total = float(df["cost"].sum(skipna=True)) if "cost" in df.columns else 0.0
    profit_total = float(df["profit"].sum(skipna=True)) if "profit" in df.columns else (revenue_total - cost_total)
    discount_total = float(df["discount"].sum(skipna=True)) if "discount" in df.columns else 0.0

    customer_orders = df[df["customerId"].notna() & (df["customerId"].astype(str).str.strip() != "")]
    order_counts = customer_orders.groupby("customerId").size()
    unique_customers = int(order_counts.shape[0])
    returning_customers = int((order_counts > 1).sum())

    return {
        "revenue": revenue_total,
        "orders": orders,
        "unitsSold": units_total,
        "averageOrderValue": (revenue_total / orders) if orders > 0 else None,
        "averageRevenuePerCustomer": (revenue_total / unique_customers) if unique_customers > 0 else None,
        "cost": cost_total,
        "profit": profit_total,
        "profitMargin": (profit_total / revenue_total) if revenue_total > 0 else None,
        "discountRate": (discount_total / (revenue_total + discount_total)) if (revenue_total + discount_total) > 0 else None,
        "repeatCustomerRate": (returning_customers / unique_customers) if unique_customers > 0 else None,
        "newCustomerCount": unique_customers - returning_customers,
        "returningCustomerCount": returning_customers,
        "uniqueCustomers": unique_customers,
        "topProducts": _rank_by(df, "product"),
        "topCategories": _rank_by(df, "category"),
        "topChannels": _rank_by(df, "channel"),
        "topRegions": _rank_by(df, "region"),
    }


def _compute_segmentation(df: pd.DataFrame) -> dict:
    eligible = df[df["customerId"].notna() & df["date"].notna() & (df["customerId"].astype(str).str.strip() != "")].copy()
    if eligible.empty:
        return {"available": False, "unavailableReason": "Segmentation requires Customer ID and Date on at least one row.", "customers": [], "summaries": []}

    eligible["date"] = pd.to_datetime(eligible["date"])
    as_of_date = eligible["date"].max()

    grouped = eligible.groupby("customerId").agg(
        frequency=("orderId", "count"),
        monetary=("revenue", "sum"),
        last_order_date=("date", "max"),
    )
    grouped["recency_days"] = (as_of_date - grouped["last_order_date"]).dt.days
    grouped["segment"] = [
        _classify_segment(int(f), float(m), float(r))
        for f, m, r in zip(grouped["frequency"], grouped["monetary"], grouped["recency_days"])
    ]

    customers = [
        {
            "customerId": customer_id,
            "recencyDays": int(row["recency_days"]),
            "frequency": int(row["frequency"]),
            "monetary": float(row["monetary"]),
            "segment": row["segment"],
        }
        for customer_id, row in grouped.iterrows()
    ]

    total_revenue = grouped["monetary"].sum()
    summaries = (
        grouped.groupby("segment")
        .agg(customerCount=("frequency", "count"), revenue=("monetary", "sum"), averageOrderFrequency=("frequency", "mean"), averageRecencyDays=("recency_days", "mean"))
        .reset_index()
    )
    summaries["revenueShare"] = summaries["revenue"] / total_revenue if total_revenue > 0 else 0.0
    summaries = summaries.drop(columns=["revenue"]).sort_values("customerCount", ascending=False)

    return {
        "available": True,
        "asOfDate": as_of_date.date().isoformat(),
        "customers": customers,
        "summaries": summaries.to_dict(orient="records"),
    }


@dataclass(frozen=True)
class MetricsResult:
    logical_date: str
    output_dir: str
    metrics_path: str
    kpi_summary: dict

    def to_xcom_dict(self) -> dict:
        return {
            "logicalDate": self.logical_date,
            "outputDir": self.output_dir,
            "metricsPath": self.metrics_path,
            "kpiSummary": self.kpi_summary,
        }


def calculate_metrics_impl(join_result: dict) -> MetricsResult:
    out_dir = Path(join_result["outputDir"])
    df = pd.read_csv(join_result["joinedPath"], dtype={"customerId": str, "orderId": str})

    kpis = _compute_kpis(df)
    segmentation = _compute_segmentation(df)

    metrics_path = out_dir / "04_metrics.json"
    atomic_write_json(metrics_path, {"kpis": kpis, "segmentation": segmentation})

    top_product = kpis["topProducts"][0]["label"] if kpis["topProducts"] else None
    kpi_summary = {
        "revenue": round(kpis["revenue"], 2),
        "orders": kpis["orders"],
        "profitMargin": round(kpis["profitMargin"], 4) if kpis["profitMargin"] is not None else None,
        "uniqueCustomers": kpis["uniqueCustomers"],
        "topProduct": top_product,
    }

    result = MetricsResult(
        logical_date=join_result["logicalDate"],
        output_dir=str(out_dir),
        metrics_path=str(metrics_path),
        kpi_summary=kpi_summary,
    )
    logger.info("Computed metrics: revenue=%.2f orders=%d", kpis["revenue"], kpis["orders"])
    return result
