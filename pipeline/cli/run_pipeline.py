"""Standalone CLI: runs the full InsightForge ETL pipeline without Airflow.

Calls the exact same `*_impl` functions the Airflow DAG's tasks call
(pipeline/dags/insightforge_etl_dag.py), so this is a genuine demonstration
of a complete successful pipeline run, not a separate reimplementation.
Usable both as the "quick demo" path for buyers without Docker/Airflow, and
as the fast path for automated tests.

Usage:
    python -m cli.run_pipeline --logical-date 2026-08-16
    python -m cli.run_pipeline --logical-date 2026-08-16 --input-dir sample_data --output-dir output
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parent.parent
if str(PIPELINE_ROOT) not in sys.path:
    sys.path.insert(0, str(PIPELINE_ROOT))

from transforms import clean, discover, export, join, metrics, quality_report, validate  # noqa: E402
from transforms.io_utils import output_dir_for  # noqa: E402
from transforms.logging_utils import PipelineError, get_logger  # noqa: E402

logger = get_logger("cli.run_pipeline")


def run_pipeline(input_dir: str | Path, logical_date: str, output_base_dir: str | Path | None = None) -> dict:
    """Runs every pipeline stage in order and returns the final quality-report XCom dict."""
    out_dir = output_dir_for(logical_date, base_dir=output_base_dir)

    manifest = discover.discover_inputs_impl(input_dir=input_dir, output_dir=out_dir, logical_date=logical_date).to_xcom_dict()
    validation = validate.validate_schema_impl(manifest).to_xcom_dict()
    clean_result = clean.clean_and_deduplicate_impl(manifest, validation).to_xcom_dict()
    join_result = join.join_datasets_impl(clean_result).to_xcom_dict()
    metrics_result = metrics.calculate_metrics_impl(join_result).to_xcom_dict()
    export_result = export.export_dashboard_data_impl(join_result, metrics_result).to_xcom_dict()
    quality_result = quality_report.generate_quality_report_impl(
        validation, clean_result, join_result, metrics_result, export_result
    ).to_xcom_dict()

    logger.info(
        "Pipeline run complete for logical date %s - quality score %d/100, output at %s",
        logical_date,
        quality_result["overallScore"],
        quality_result["outputDir"],
    )
    return quality_result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run the InsightForge ETL pipeline end-to-end without Airflow.")
    parser.add_argument("--logical-date", required=True, help="Logical date for this run, e.g. 2026-08-16 (also used as the output subdirectory name).")
    parser.add_argument("--input-dir", default=str(PIPELINE_ROOT / "sample_data"), help="Directory containing sales.csv, customers.csv, reviews.csv.")
    parser.add_argument("--output-dir", default=str(PIPELINE_ROOT / "output"), help="Base output directory; results are written under <output-dir>/<logical-date>/.")
    args = parser.parse_args(argv)

    try:
        result = run_pipeline(args.input_dir, args.logical_date, args.output_dir)
    except PipelineError as exc:
        logger.error("Pipeline run failed: %s", exc)
        return 1

    print(f"SUCCESS: quality score {result['overallScore']}/100")
    print(f"Output directory: {result['outputDir']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
