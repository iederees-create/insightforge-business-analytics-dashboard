from __future__ import annotations

import json

import pandas as pd

from transforms.clean import clean_and_deduplicate_impl
from transforms.discover import discover_inputs_impl
from transforms.export import export_dashboard_data_impl
from transforms.join import join_datasets_impl
from transforms.metrics import calculate_metrics_impl
from transforms.validate import validate_schema_impl


def _run_through_export(tmp_path, write_csv):
    write_csv(
        "sales.csv",
        "date,orderId,customerId,product,category,quantity,revenue,channel\n"
        "2026-01-01,ORD-1,CUST-1,Widget,Home,1,10,Online Store\n",
    )
    write_csv("customers.csv", "customerId,customerName\nCUST-1,Alice\n")
    write_csv("reviews.csv", "orderId,product,rating\nORD-1,Widget,5\n")

    manifest = discover_inputs_impl(input_dir=tmp_path, output_dir=tmp_path / "out", logical_date="2026-08-16").to_xcom_dict()
    validation = validate_schema_impl(manifest).to_xcom_dict()
    clean_result = clean_and_deduplicate_impl(manifest, validation).to_xcom_dict()
    join_result = join_datasets_impl(clean_result).to_xcom_dict()
    metrics_result = calculate_metrics_impl(join_result).to_xcom_dict()
    return export_dashboard_data_impl(join_result, metrics_result)


def test_exported_csv_uses_dashboard_friendly_headers(tmp_path, write_csv):
    result = _run_through_export(tmp_path, write_csv)
    exported = pd.read_csv(result.csv_path)
    # These exact header strings are what src/lib/csv/mapping.ts's autoDetectMapping
    # keyword-matches against - see EXPORT_COLUMNS in transforms/export.py.
    for expected_header in ["Date", "Order ID", "Product", "Category", "Quantity", "Revenue", "Channel"]:
        assert expected_header in exported.columns


def test_exported_json_contains_kpis_and_segmentation(tmp_path, write_csv):
    result = _run_through_export(tmp_path, write_csv)
    payload = json.loads(open(result.json_path).read())
    assert "kpis" in payload
    assert "segmentation" in payload
    assert payload["rowCount"] == 1
