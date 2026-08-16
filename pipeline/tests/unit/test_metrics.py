from __future__ import annotations

from transforms.clean import clean_and_deduplicate_impl
from transforms.discover import discover_inputs_impl
from transforms.join import join_datasets_impl
from transforms.metrics import calculate_metrics_impl
from transforms.validate import validate_schema_impl


def test_kpi_formulas_match_hand_computed_values(tmp_path, write_csv):
    # Two orders, one customer: revenue 100 + 50 = 150, cost 60 + 20 = 80.
    write_csv(
        "sales.csv",
        "date,orderId,customerId,revenue,cost\n"
        "2026-01-01,ORD-1,CUST-1,100,60\n"
        "2026-01-05,ORD-2,CUST-1,50,20\n",
    )
    write_csv("customers.csv", "customerId,customerName\nCUST-1,Alice\n")
    write_csv("reviews.csv", "orderId,rating\nORD-1,5\n")

    manifest = discover_inputs_impl(input_dir=tmp_path, output_dir=tmp_path / "out", logical_date="2026-08-16").to_xcom_dict()
    validation = validate_schema_impl(manifest).to_xcom_dict()
    clean_result = clean_and_deduplicate_impl(manifest, validation).to_xcom_dict()
    join_result = join_datasets_impl(clean_result).to_xcom_dict()

    result = calculate_metrics_impl(join_result)

    kpi_summary = result.kpi_summary
    assert kpi_summary["revenue"] == 150.0
    assert kpi_summary["orders"] == 2
    # profit = revenue - cost = 150 - 80 = 70; margin = 70 / 150 (kpi_summary rounds to 4dp)
    assert kpi_summary["profitMargin"] == round(70 / 150, 4)


def test_repeat_customer_is_classified_correctly(tmp_path, write_csv):
    # Same customer orders twice -> frequency 2 -> "Repeat" segment (< loyalOrderCount of 4).
    write_csv(
        "sales.csv",
        "date,orderId,customerId,revenue\n"
        "2026-01-01,ORD-1,CUST-1,10\n"
        "2026-01-02,ORD-2,CUST-1,10\n",
    )
    write_csv("customers.csv", "customerId,customerName\nCUST-1,Alice\n")
    write_csv("reviews.csv", "orderId,rating\nORD-1,5\n")

    manifest = discover_inputs_impl(input_dir=tmp_path, output_dir=tmp_path / "out", logical_date="2026-08-16").to_xcom_dict()
    validation = validate_schema_impl(manifest).to_xcom_dict()
    clean_result = clean_and_deduplicate_impl(manifest, validation).to_xcom_dict()
    join_result = join_datasets_impl(clean_result).to_xcom_dict()
    result = calculate_metrics_impl(join_result)

    import json

    metrics_payload = json.loads((tmp_path / "out" / "04_metrics.json").read_text())
    segment = metrics_payload["segmentation"]["customers"][0]["segment"]
    assert segment == "Repeat"
    assert result.kpi_summary["orders"] == 2
