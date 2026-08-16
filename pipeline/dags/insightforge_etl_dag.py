"""InsightForge ETL pipeline DAG.

Optional, advanced/developer feature - orchestrates repeatable ingestion,
cleaning, KPI calculation, and dashboard-ready export for InsightForge's
sales/customer/review CSVs. Entirely separate from the core no-code web app.

This file is intentionally thin: every task body is a small adapter that
pulls plain values out of Airflow's context, calls the matching pure
`*_impl` function in transforms/, and returns a small JSON-serialisable
dict for XCom (never a DataFrame - see docs/ARCHITECTURE.md). All actual
data processing lives in transforms/ and cli/run_pipeline.py calls the
exact same functions outside of Airflow.

See docs/QUICKSTART.md to run this, and docs/TROUBLESHOOTING.md if a task
fails.
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path

from airflow.decorators import dag, task
from airflow.exceptions import AirflowException

PIPELINE_ROOT = Path(__file__).resolve().parent.parent
if str(PIPELINE_ROOT) not in sys.path:
    sys.path.insert(0, str(PIPELINE_ROOT))

DEFAULT_ARGS = {
    "owner": "insightforge",
    "retries": 2,
    "retry_delay": timedelta(minutes=1),
    "retry_exponential_backoff": True,
}


@dag(
    dag_id="insightforge_etl",
    description="Optional InsightForge ETL pipeline: CSV ingestion -> validation -> cleaning -> KPIs -> dashboard export -> quality report.",
    schedule=None,  # manual-trigger demo DAG; set to "@daily" for a real recurring schedule.
    start_date=datetime(2026, 1, 1),
    catchup=False,
    default_args=DEFAULT_ARGS,
    tags=["insightforge", "etl", "demo"],
)
def insightforge_etl():
    @task
    def discover_inputs(**context) -> dict:
        from transforms.discover import discover_inputs_impl
        from transforms.io_utils import output_dir_for
        from transforms.logging_utils import PipelineError

        logical_date = context["logical_date"].date().isoformat()
        out_dir = output_dir_for(logical_date)
        try:
            return discover_inputs_impl(
                input_dir=PIPELINE_ROOT / "sample_data",
                output_dir=out_dir,
                logical_date=logical_date,
            ).to_xcom_dict()
        except PipelineError as exc:
            raise AirflowException(str(exc)) from exc

    @task
    def validate_schema(manifest: dict) -> dict:
        from transforms.logging_utils import PipelineError
        from transforms.validate import validate_schema_impl

        try:
            return validate_schema_impl(manifest).to_xcom_dict()
        except PipelineError as exc:
            raise AirflowException(str(exc)) from exc

    @task
    def clean_and_deduplicate(manifest: dict, validation: dict) -> dict:
        from transforms.clean import clean_and_deduplicate_impl
        from transforms.logging_utils import PipelineError

        try:
            return clean_and_deduplicate_impl(manifest, validation).to_xcom_dict()
        except PipelineError as exc:
            raise AirflowException(str(exc)) from exc

    @task
    def join_datasets(clean_result: dict) -> dict:
        from transforms.join import join_datasets_impl
        from transforms.logging_utils import PipelineError

        try:
            return join_datasets_impl(clean_result).to_xcom_dict()
        except PipelineError as exc:
            raise AirflowException(str(exc)) from exc

    @task
    def calculate_metrics(join_result: dict) -> dict:
        from transforms.metrics import calculate_metrics_impl

        return calculate_metrics_impl(join_result).to_xcom_dict()

    @task
    def export_dashboard_data(join_result: dict, metrics_result: dict) -> dict:
        from transforms.export import export_dashboard_data_impl

        return export_dashboard_data_impl(join_result, metrics_result).to_xcom_dict()

    @task
    def generate_quality_report(validation: dict, clean_result: dict, join_result: dict, metrics_result: dict, export_result: dict) -> dict:
        from transforms.quality_report import generate_quality_report_impl

        return generate_quality_report_impl(validation, clean_result, join_result, metrics_result, export_result).to_xcom_dict()

    manifest = discover_inputs()
    validation = validate_schema(manifest)
    clean_result = clean_and_deduplicate(manifest, validation)
    join_result = join_datasets(clean_result)
    metrics_result = calculate_metrics(join_result)
    export_result = export_dashboard_data(join_result, metrics_result)
    generate_quality_report(validation, clean_result, join_result, metrics_result, export_result)


insightforge_etl()
