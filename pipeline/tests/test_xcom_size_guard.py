"""Regression guard: every task's XCom payload must stay small (paths and
metadata only, never a DataFrame) - see the "no DataFrames through XCom"
requirement in docs/ARCHITECTURE.md. Runs the real sample_data/ once and
checks the JSON-serialised size of every to_xcom_dict() output.
"""

from __future__ import annotations

import json
from pathlib import Path

from cli.run_pipeline import run_pipeline
from transforms.clean import clean_and_deduplicate_impl
from transforms.discover import discover_inputs_impl
from transforms.export import export_dashboard_data_impl
from transforms.io_utils import output_dir_for
from transforms.join import join_datasets_impl
from transforms.metrics import calculate_metrics_impl
from transforms.quality_report import generate_quality_report_impl
from transforms.validate import validate_schema_impl

PIPELINE_ROOT = Path(__file__).resolve().parent.parent
SAMPLE_DATA_DIR = PIPELINE_ROOT / "sample_data"
MAX_XCOM_BYTES = 10_000


def _assert_small_and_serializable(name: str, payload: dict) -> None:
    serialized = json.dumps(payload)
    assert len(serialized.encode("utf-8")) < MAX_XCOM_BYTES, f"{name} XCom payload is {len(serialized)} bytes - looks like it may contain full row data"


def test_every_task_xcom_payload_is_small_and_json_safe(tmp_path):
    out_dir = output_dir_for("2026-08-16", base_dir=tmp_path)

    manifest = discover_inputs_impl(input_dir=SAMPLE_DATA_DIR, output_dir=out_dir, logical_date="2026-08-16")
    _assert_small_and_serializable("discover_inputs", manifest.to_xcom_dict())

    validation = validate_schema_impl(manifest.to_xcom_dict())
    _assert_small_and_serializable("validate_schema", validation.to_xcom_dict())

    clean_result = clean_and_deduplicate_impl(manifest.to_xcom_dict(), validation.to_xcom_dict())
    _assert_small_and_serializable("clean_and_deduplicate", clean_result.to_xcom_dict())

    join_result = join_datasets_impl(clean_result.to_xcom_dict())
    _assert_small_and_serializable("join_datasets", join_result.to_xcom_dict())

    metrics_result = calculate_metrics_impl(join_result.to_xcom_dict())
    _assert_small_and_serializable("calculate_metrics", metrics_result.to_xcom_dict())

    export_result = export_dashboard_data_impl(join_result.to_xcom_dict(), metrics_result.to_xcom_dict())
    _assert_small_and_serializable("export_dashboard_data", export_result.to_xcom_dict())

    quality_result = generate_quality_report_impl(
        validation.to_xcom_dict(), clean_result.to_xcom_dict(), join_result.to_xcom_dict(), metrics_result.to_xcom_dict(), export_result.to_xcom_dict()
    )
    _assert_small_and_serializable("generate_quality_report", quality_result.to_xcom_dict())
