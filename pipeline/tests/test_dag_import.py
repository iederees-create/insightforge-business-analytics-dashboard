"""DAG import test - the required deliverable.

Three checks, cheapest first: (a) a bare Python import catches syntax/import
errors instantly with no Airflow DB involved; (b) Airflow's own recommended
DagBag-parses-cleanly check; (c) structural assertions on the parsed DAG so a
future edit that silently detaches or reorders a task fails CI immediately.
"""

from __future__ import annotations

import importlib
import os
from pathlib import Path

import pytest

PIPELINE_ROOT = Path(__file__).resolve().parent.parent

EXPECTED_TASK_IDS = {
    "discover_inputs",
    "validate_schema",
    "clean_and_deduplicate",
    "join_datasets",
    "calculate_metrics",
    "export_dashboard_data",
    "generate_quality_report",
}

EXPECTED_DOWNSTREAM = {
    "discover_inputs": {"validate_schema", "clean_and_deduplicate"},
    "validate_schema": {"clean_and_deduplicate", "generate_quality_report"},
    "clean_and_deduplicate": {"join_datasets", "generate_quality_report"},
    "join_datasets": {"calculate_metrics", "export_dashboard_data", "generate_quality_report"},
    "calculate_metrics": {"export_dashboard_data", "generate_quality_report"},
    "export_dashboard_data": {"generate_quality_report"},
    "generate_quality_report": set(),
}


def test_dag_module_imports_without_error():
    module = importlib.import_module("dags.insightforge_etl_dag")
    assert hasattr(module, "insightforge_etl")


@pytest.fixture(scope="module")
def dagbag():
    os.environ.setdefault("AIRFLOW_HOME", str(PIPELINE_ROOT / ".airflow-home"))
    os.environ.setdefault("AIRFLOW__CORE__DAGS_FOLDER", str(PIPELINE_ROOT / "dags"))
    os.environ.setdefault("AIRFLOW__CORE__LOAD_EXAMPLES", "false")
    from airflow.models import DagBag

    return DagBag(dag_folder=str(PIPELINE_ROOT / "dags"), include_examples=False)


def test_dagbag_has_no_import_errors(dagbag):
    assert dagbag.import_errors == {}


def test_dag_is_registered(dagbag):
    assert "insightforge_etl" in dagbag.dags


def test_dag_has_exactly_the_expected_tasks(dagbag):
    dag = dagbag.dags["insightforge_etl"]
    assert set(dag.task_dict.keys()) == EXPECTED_TASK_IDS


def test_dag_task_dependencies_match_spec(dagbag):
    dag = dagbag.dags["insightforge_etl"]
    for task_id, expected_downstream in EXPECTED_DOWNSTREAM.items():
        actual = dag.task_dict[task_id].downstream_task_ids
        assert actual == expected_downstream, f"{task_id}: expected downstream {expected_downstream}, got {actual}"


def test_dag_default_args_configure_retries(dagbag):
    dag = dagbag.dags["insightforge_etl"]
    assert dag.default_args["retries"] == 2
