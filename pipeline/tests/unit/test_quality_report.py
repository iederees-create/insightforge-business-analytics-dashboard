from __future__ import annotations

from transforms.clean import clean_and_deduplicate_impl
from transforms.discover import discover_inputs_impl
from transforms.export import export_dashboard_data_impl
from transforms.join import join_datasets_impl
from transforms.metrics import calculate_metrics_impl
from transforms.quality_report import generate_quality_report_impl
from transforms.validate import validate_schema_impl


def _run_full(tmp_path, write_csv, sales_content: str):
    write_csv("sales.csv", sales_content)
    write_csv("customers.csv", "customerId,customerName\nCUST-1,Alice\n")
    write_csv("reviews.csv", "orderId,rating\nORD-1,5\n")

    manifest = discover_inputs_impl(input_dir=tmp_path, output_dir=tmp_path / "out", logical_date="2026-08-16").to_xcom_dict()
    validation = validate_schema_impl(manifest).to_xcom_dict()
    clean_result = clean_and_deduplicate_impl(manifest, validation).to_xcom_dict()
    join_result = join_datasets_impl(clean_result).to_xcom_dict()
    metrics_result = calculate_metrics_impl(join_result).to_xcom_dict()
    export_result = export_dashboard_data_impl(join_result, metrics_result).to_xcom_dict()
    return generate_quality_report_impl(validation, clean_result, join_result, metrics_result, export_result)


def test_clean_data_scores_100_with_no_issues(tmp_path, write_csv):
    result = _run_full(
        tmp_path,
        write_csv,
        "date,orderId,customerId,revenue\n2026-01-01,ORD-1,CUST-1,10\n2026-01-02,ORD-2,CUST-1,20\n",
    )

    assert result.overall_score == 100


def test_missing_values_lower_the_score_and_appear_as_issues(tmp_path, write_csv):
    result = _run_full(
        tmp_path,
        write_csv,
        "date,orderId,customerId,revenue\n2026-01-01,ORD-1,CUST-1,\n2026-01-02,ORD-2,CUST-1,20\n",
    )

    assert result.overall_score < 100
    import json

    report = json.loads(open(result.report_json_path).read())
    issue_ids = [issue["id"] for issue in report["issues"]]
    assert "missing-sales-revenue" in issue_ids


def test_success_marker_is_written(tmp_path, write_csv):
    result = _run_full(
        tmp_path,
        write_csv,
        "date,orderId,customerId,revenue\n2026-01-01,ORD-1,CUST-1,10\n",
    )

    from pathlib import Path

    assert Path(result.success_marker_path).exists()
    assert "2026-08-16" in Path(result.success_marker_path).read_text()
