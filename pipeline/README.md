# InsightForge ETL Pipeline (optional, advanced/developer feature)

An Apache Airflow pipeline that automates what the no-code dashboard's
Import Wizard does manually: discover sales/customer/review CSVs, validate
and clean them, join them together, calculate KPIs, and export a
dashboard-ready CSV/JSON. It is entirely separate from the core browser
app - the app still works exactly as before, with zero changes, whether or
not you ever open this directory.

Who this is for: buyers who want repeatable, scheduled, or scripted data
prep instead of manually uploading a CSV through the browser each time
(e.g. a nightly job that regenerates a fresh export from raw exports).

## Quick start

See [`docs/QUICKSTART.md`](docs/QUICKSTART.md) for the full walkthrough.
Fastest path (no Docker, no Airflow scheduler required):

```bash
cd pipeline
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt --constraint https://raw.githubusercontent.com/apache/airflow/constraints-2.10.5/constraints-3.12.txt
python -m cli.run_pipeline --logical-date 2026-08-16
```

This produces a full pipeline run under `output/2026-08-16/`, including a
dashboard-ready CSV you can drag straight into the main app's Import Wizard.

## What's included

- `dags/insightforge_etl_dag.py` - the Airflow DAG (TaskFlow API).
- `transforms/` - the actual logic, as plain reusable Python functions.
- `cli/run_pipeline.py` - runs the exact same functions without Airflow.
- `sample_data/` - synthetic, seeded sales/customers/reviews CSVs with
  deliberate data-quality issues, so validation/cleaning/quality-report
  have real things to find.
- `docs/` - architecture, data dictionary, troubleshooting, quick start.
- `tests/` - unit tests, a DAG import test, and a full-run idempotency test.
- `Dockerfile` / `docker-compose.yaml` - optional containerized setup
  (see the honesty disclosure in `docs/QUICKSTART.md`).

## What this is NOT

Not a replacement for the browser dashboard, not a hosted service, not a
guarantee of any particular business outcome. It processes local files on
your own machine - nothing is uploaded anywhere.

## Requirements

- Python 3.12 (a virtualenv is created for you by the quick start above).
- Optionally Docker, if you prefer the containerized path.
- No API keys, accounts, or credentials of any kind.
