from __future__ import annotations

import pytest

from transforms.discover import discover_inputs_impl
from transforms.logging_utils import SchemaValidationError
from transforms.validate import validate_schema_impl


def _manifest(tmp_path, write_csv, sales_content: str) -> dict:
    write_csv("sales.csv", sales_content)
    write_csv("customers.csv", "customerId,customerName\nCUST-1,Alice\n")
    write_csv("reviews.csv", "orderId,rating\nORD-1,5\n")
    return discover_inputs_impl(input_dir=tmp_path, output_dir=tmp_path / "out", logical_date="2026-08-16").to_xcom_dict()


def test_missing_required_column_raises_with_column_name(tmp_path, write_csv):
    # revenue is a required sales column and is entirely absent here.
    manifest = _manifest(tmp_path, write_csv, "date,orderId\n2026-01-01,ORD-1\n")

    with pytest.raises(SchemaValidationError) as exc_info:
        validate_schema_impl(manifest)

    assert "sales.csv" in str(exc_info.value)
    assert "revenue" in str(exc_info.value)


def test_missing_optional_values_are_counted_not_fatal(tmp_path, write_csv):
    manifest = _manifest(
        tmp_path,
        write_csv,
        "date,orderId,revenue,category\n2026-01-01,ORD-1,10,Home\n2026-01-02,ORD-2,20,\n",
    )

    result = validate_schema_impl(manifest)

    assert result.passed is True
    assert result.per_file["sales"].missing_value_counts["category"] == 1


def test_malformed_numeric_value_is_a_type_violation(tmp_path, write_csv):
    manifest = _manifest(
        tmp_path,
        write_csv,
        "date,orderId,revenue\n2026-01-01,ORD-1,not-a-number\n",
    )

    result = validate_schema_impl(manifest)

    assert result.per_file["sales"].type_violations["revenue"] == 1


def test_zero_rows_is_a_hard_failure(tmp_path, write_csv):
    manifest = _manifest(tmp_path, write_csv, "date,orderId,revenue\n")

    with pytest.raises(SchemaValidationError) as exc_info:
        validate_schema_impl(manifest)

    assert "zero parseable rows" in str(exc_info.value)
