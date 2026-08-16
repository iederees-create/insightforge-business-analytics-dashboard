"""Task 6: export_dashboard_data - writes dashboard-ready CSV + JSON.

The CSV uses the same human-readable header vocabulary as the dashboard's
COLUMN_ROLE_LABELS (src/types/domain.ts) and the built-in "Generic sales CSV"
template (src/lib/csv/templates.ts) - src/lib/csv/mapping.ts's
autoDetectMapping() keyword-matches against exactly these header words, so
this file auto-maps in the Import Wizard with zero manual column mapping.
The JSON mirrors the KpiSet/SegmentationResult shapes computed in metrics.py,
documented field-for-field in docs/DATA_DICTIONARY.md.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from transforms.io_utils import atomic_write_json
from transforms.logging_utils import get_logger

logger = get_logger("export")

# Ordered role -> dashboard-friendly header, matching COLUMN_ROLE_LABELS in
# src/types/domain.ts exactly so autoDetectMapping() recognises every column.
EXPORT_COLUMNS: dict[str, str] = {
    "date": "Date",
    "orderId": "Order ID",
    "transactionId": "Transaction ID",
    "customerId": "Customer ID",
    "customer_name": "Customer name",
    "product": "Product",
    "category": "Category",
    "quantity": "Quantity",
    "revenue": "Revenue",
    "cost": "Cost",
    "profit": "Profit",
    "discount": "Discount",
    "channel": "Channel",
    "region": "Region",
    "country": "Country",
    "average_rating": "Rating",
}


@dataclass(frozen=True)
class ExportResult:
    logical_date: str
    output_dir: str
    csv_path: str
    json_path: str
    row_count: int

    def to_xcom_dict(self) -> dict:
        return {
            "logicalDate": self.logical_date,
            "outputDir": self.output_dir,
            "csvPath": self.csv_path,
            "jsonPath": self.json_path,
            "rowCount": self.row_count,
        }


def export_dashboard_data_impl(join_result: dict, metrics_result: dict) -> ExportResult:
    out_dir = Path(join_result["outputDir"])
    joined = pd.read_csv(join_result["joinedPath"], dtype={"customerId": str, "orderId": str})

    present_columns = {role: header for role, header in EXPORT_COLUMNS.items() if role in joined.columns}
    export_df = joined[list(present_columns.keys())].rename(columns=present_columns)

    csv_path = out_dir / "05_dashboard_export.csv"
    export_df.to_csv(csv_path, index=False)

    metrics_path = Path(metrics_result["metricsPath"])
    import json as _json

    metrics_payload = _json.loads(metrics_path.read_text(encoding="utf-8"))

    json_path = out_dir / "05_dashboard_export.json"
    atomic_write_json(
        json_path,
        {
            "logicalDate": join_result["logicalDate"],
            "rowCount": len(export_df),
            "kpis": metrics_payload["kpis"],
            "segmentation": metrics_payload["segmentation"],
        },
    )

    result = ExportResult(
        logical_date=join_result["logicalDate"],
        output_dir=str(out_dir),
        csv_path=str(csv_path),
        json_path=str(json_path),
        row_count=len(export_df),
    )
    logger.info("Exported %d dashboard-ready row(s) to %s", len(export_df), csv_path)
    return result
