from __future__ import annotations

import pandas as pd

from transforms.clean import clean_and_deduplicate_impl
from transforms.discover import discover_inputs_impl
from transforms.validate import validate_schema_impl


def _run_clean(tmp_path, write_csv, sales_content: str):
    write_csv("sales.csv", sales_content)
    write_csv("customers.csv", "customerId,customerName\nCUST-1,Alice\n")
    write_csv("reviews.csv", "orderId,rating\nORD-1,5\n")
    manifest = discover_inputs_impl(input_dir=tmp_path, output_dir=tmp_path / "out", logical_date="2026-08-16").to_xcom_dict()
    validation = validate_schema_impl(manifest).to_xcom_dict()
    return clean_and_deduplicate_impl(manifest, validation)


def test_exact_duplicate_row_is_removed(tmp_path, write_csv):
    result = _run_clean(
        tmp_path,
        write_csv,
        "date,orderId,revenue\n2026-01-01,ORD-1,10\n2026-01-01,ORD-1,10\n2026-01-02,ORD-2,20\n",
    )

    assert result.rows_removed["sales"] == 1
    cleaned = pd.read_csv(result.cleaned_paths["sales"])
    assert len(cleaned) == 2


def test_malformed_date_becomes_blank_not_zero(tmp_path, write_csv):
    result = _run_clean(
        tmp_path,
        write_csv,
        "date,orderId,revenue\nnot-a-date,ORD-1,10\n2026-01-02,ORD-2,20\n",
    )

    cleaned = pd.read_csv(result.cleaned_paths["sales"], dtype=str, keep_default_na=False)
    row = cleaned[cleaned["orderId"] == "ORD-1"].iloc[0]
    assert row["date"] == ""


def test_category_casing_is_standardized_to_most_frequent_variant(tmp_path, write_csv):
    result = _run_clean(
        tmp_path,
        write_csv,
        "date,orderId,revenue,category\n"
        "2026-01-01,ORD-1,10,Home\n"
        "2026-01-02,ORD-2,20,Home\n"
        "2026-01-03,ORD-3,30,home \n",
    )

    assert result.category_labels_standardized == 1
    cleaned = pd.read_csv(result.cleaned_paths["sales"])
    assert set(cleaned["category"].unique()) == {"Home"}


def test_duplicate_order_id_with_different_content_is_reported_not_removed(tmp_path, write_csv):
    result = _run_clean(
        tmp_path,
        write_csv,
        "date,orderId,revenue\n2026-01-01,ORD-1,10\n2026-01-05,ORD-1,999\n",
    )

    assert result.rows_removed["sales"] == 0
    cleaned = pd.read_csv(result.cleaned_paths["sales"])
    assert len(cleaned) == 2
