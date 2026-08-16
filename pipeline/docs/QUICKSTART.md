# Pipeline Quick Start

Two paths - pick whichever fits. Path B is the one that was actually run
and verified while building this feature; Path A was authored carefully
but see the honesty note below.

## Path B: Python only, no Docker (verified)

```bash
cd pipeline
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements-dev.txt --constraint https://raw.githubusercontent.com/apache/airflow/constraints-2.10.5/constraints-3.12.txt
```

Run the full pipeline once, without needing Airflow's scheduler at all:

```bash
python -m cli.run_pipeline --logical-date 2026-08-16
```

You should see `SUCCESS: quality score 92/100` and a new
`output/2026-08-16/` directory containing 14 files, ending in a
`_SUCCESS` marker. Open `output/2026-08-16/06_quality_report.md` to read
the human-readable data-quality summary, or drag
`output/2026-08-16/05_dashboard_export.csv` straight into the main app's
Import Wizard (`npm run dev` from the repo root) - every column auto-maps.

To also run it as a real Airflow DAG (still no persistent webserver needed):

```bash
export AIRFLOW_HOME="$(pwd)/.airflow-home"
export AIRFLOW__CORE__DAGS_FOLDER="$(pwd)/dags"
export AIRFLOW__CORE__LOAD_EXAMPLES=false
airflow db migrate
airflow dags list-import-errors        # should print "No data found"
airflow dags test insightforge_etl 2026-08-16
```

To run the automated test suite:

```bash
python -m pytest tests/ -v
```

## Path A: Docker

```bash
cd pipeline
docker compose up
```

Open http://localhost:8080. Airflow's `standalone` mode prints a
randomly-generated admin username/password to the container logs on first
run (never committed anywhere, never hard-coded) - log in with that, then
trigger the `insightforge_etl` DAG from the UI.

**Honesty disclosure:** this Docker setup was authored on a machine that
did not have Docker installed, so it has not been build/run-tested in the
environment that built this feature. It was validated indirectly instead:
the exact same pinned Airflow version (`apache-airflow==2.10.5`) was
installed in a local virtualenv (Path B above) and exercised via
`airflow dags list-import-errors`, `airflow dags test`, and the standalone
CLI - all of which passed, with real output files and a genuine 92/100
data-quality score against the seeded synthetic data. If `docker compose up`
surfaces something Path B's testing didn't catch, see
[`TROUBLESHOOTING.md`](TROUBLESHOOTING.md).

## What you should see either way

- 7 tasks run in order: `discover_inputs` → `validate_schema` →
  `clean_and_deduplicate` → `join_datasets` → `calculate_metrics` →
  `export_dashboard_data` → `generate_quality_report`.
- A data-quality report (`06_quality_report.md`) listing real issues found
  in the seeded synthetic data (missing revenue values, malformed dates,
  duplicate rows, duplicate order IDs, sales referencing an unknown
  customer) - nothing here is fabricated; every issue traces back to a
  deliberately-injected problem in `sample_data/` (see
  `scripts/generate_sample_data.py`).
- A dashboard-ready export (`05_dashboard_export.csv` /
  `.json`) that auto-maps in the browser app with zero manual column work.
