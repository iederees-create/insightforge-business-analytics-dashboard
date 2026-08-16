"""Full synthetic pipeline run test - the required "successful pipeline run"
deliverable, exercised as a test. Runs cli.run_pipeline against the real
committed pipeline/sample_data/, then runs it a second time into the same
output directory and diffs every file byte-for-byte to prove idempotency.
"""

from __future__ import annotations

import filecmp
import shutil
from pathlib import Path

from cli.run_pipeline import run_pipeline

PIPELINE_ROOT = Path(__file__).resolve().parent.parent
SAMPLE_DATA_DIR = PIPELINE_ROOT / "sample_data"

EXPECTED_OUTPUT_FILES = [
    "00_manifest.json",
    "01_validation_report.json",
    "02_cleaned_sales.csv",
    "02_cleaned_customers.csv",
    "02_cleaned_reviews.csv",
    "02_dedupe_report.json",
    "03_joined_dataset.csv",
    "03_join_summary.json",
    "04_metrics.json",
    "05_dashboard_export.csv",
    "05_dashboard_export.json",
    "06_quality_report.json",
    "06_quality_report.md",
    "_SUCCESS",
]


def test_full_pipeline_run_produces_all_expected_outputs(tmp_path):
    result = run_pipeline(input_dir=SAMPLE_DATA_DIR, logical_date="2026-08-16", output_base_dir=tmp_path)

    out_dir = Path(result["outputDir"])
    for filename in EXPECTED_OUTPUT_FILES:
        path = out_dir / filename
        assert path.exists() and path.stat().st_size > 0, f"missing or empty: {filename}"


def test_quality_report_catches_the_seeded_data_quality_issues(tmp_path):
    result = run_pipeline(input_dir=SAMPLE_DATA_DIR, logical_date="2026-08-16", output_base_dir=tmp_path)

    import json

    report = json.loads(Path(result["reportJsonPath"]).read_text())
    assert len(report["issues"]) > 0, "expected the deliberately-seeded data-quality issues to be caught"
    assert 0 <= report["score"] <= 100


def test_rerunning_for_the_same_logical_date_is_byte_for_byte_idempotent(tmp_path):
    run_pipeline(input_dir=SAMPLE_DATA_DIR, logical_date="2026-08-16", output_base_dir=tmp_path)
    first_run_copy = tmp_path / "_first_run_copy"
    shutil.copytree(tmp_path / "2026-08-16", first_run_copy)

    run_pipeline(input_dir=SAMPLE_DATA_DIR, logical_date="2026-08-16", output_base_dir=tmp_path)
    second_run_dir = tmp_path / "2026-08-16"

    comparison = filecmp.dircmp(first_run_copy, second_run_dir)
    assert comparison.diff_files == [], f"non-idempotent output files: {comparison.diff_files}"
    assert comparison.left_only == [] and comparison.right_only == []
