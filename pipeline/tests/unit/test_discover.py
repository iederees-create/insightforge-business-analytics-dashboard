from __future__ import annotations

import pytest

from transforms.discover import discover_inputs_impl
from transforms.logging_utils import InputDiscoveryError


def _write_all_three(tmp_path, write_csv):
    write_csv("sales.csv", "date,orderId,revenue\n2026-01-01,ORD-1,10\n2026-01-02,ORD-2,20\n")
    write_csv("customers.csv", "customerId,customerName\nCUST-1,Alice\n")
    write_csv("reviews.csv", "orderId,rating\nORD-1,5\n")


def test_discover_finds_all_three_files_and_counts_rows(tmp_path, write_csv):
    _write_all_three(tmp_path, write_csv)
    out_dir = tmp_path / "out"

    result = discover_inputs_impl(input_dir=tmp_path, output_dir=out_dir, logical_date="2026-08-16")

    assert set(result.files.keys()) == {"sales", "customers", "reviews"}
    assert result.files["sales"].rows == 2
    assert result.files["customers"].rows == 1
    assert (out_dir / "00_manifest.json").exists()


def test_discover_skips_synthetic_data_comment_lines(tmp_path, write_csv):
    write_csv(
        "sales.csv",
        "# SYNTHETIC DATA\n# fictional\ndate,orderId,revenue\n2026-01-01,ORD-1,10\n",
    )
    write_csv("customers.csv", "customerId\nCUST-1\n")
    write_csv("reviews.csv", "orderId\nORD-1\n")
    out_dir = tmp_path / "out"

    result = discover_inputs_impl(input_dir=tmp_path, output_dir=out_dir, logical_date="2026-08-16")

    assert result.files["sales"].rows == 1


def test_discover_raises_with_missing_filename_in_message(tmp_path, write_csv):
    write_csv("sales.csv", "date,revenue\n2026-01-01,10\n")
    # customers.csv and reviews.csv deliberately missing.
    out_dir = tmp_path / "out"

    with pytest.raises(InputDiscoveryError) as exc_info:
        discover_inputs_impl(input_dir=tmp_path, output_dir=out_dir, logical_date="2026-08-16")

    assert "customers.csv" in str(exc_info.value)
    assert "reviews.csv" in str(exc_info.value)
