from __future__ import annotations

import pandas as pd

from transforms.clean import clean_and_deduplicate_impl
from transforms.discover import discover_inputs_impl
from transforms.join import join_datasets_impl
from transforms.validate import validate_schema_impl


def _run_join(tmp_path, write_csv):
    write_csv(
        "sales.csv",
        "date,orderId,customerId,product,revenue\n"
        "2026-01-01,ORD-1,CUST-1,Widget,10\n"
        "2026-01-02,ORD-2,CUST-999,Widget,20\n",  # CUST-999 does not exist in customers.csv
    )
    write_csv("customers.csv", "customerId,customerName\nCUST-1,Alice\n")
    write_csv("reviews.csv", "orderId,product,rating\nORD-1,Widget,5\nORD-2,Widget,3\n")

    manifest = discover_inputs_impl(input_dir=tmp_path, output_dir=tmp_path / "out", logical_date="2026-08-16").to_xcom_dict()
    validation = validate_schema_impl(manifest).to_xcom_dict()
    clean_result = clean_and_deduplicate_impl(manifest, validation).to_xcom_dict()
    return join_datasets_impl(clean_result)


def test_unmatched_customer_row_is_counted(tmp_path, write_csv):
    result = _run_join(tmp_path, write_csv)
    assert result.unmatched_customer_rows == 1
    assert result.row_count == 2


def test_review_aggregates_are_attached_by_product(tmp_path, write_csv):
    result = _run_join(tmp_path, write_csv)
    joined = pd.read_csv(result.joined_path)
    widget_rows = joined[joined["product"] == "Widget"]
    assert (widget_rows["review_count"] == 2).all()
    assert (widget_rows["average_rating"] == 4.0).all()
