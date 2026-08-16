# Troubleshooting

## DAG import errors

Run `airflow dags list-import-errors` (with `AIRFLOW_HOME` and
`AIRFLOW__CORE__DAGS_FOLDER` set as in `QUICKSTART.md`). A clean run prints
"No data found". If it prints a traceback, it's almost always either a
Python import error in `transforms/` (run
`python -c "import transforms.discover"` from `pipeline/` to isolate it) or
a missing dependency (`pip install -r requirements-dev.txt` again).

## `SchemaValidationError: ... missing required column(s) ...`

A required column (`date`/`orderId`/`revenue` for sales, `customerId` for
customers, `rating` for reviews) is entirely absent from the CSV header
row. Check the exact header spelling against `docs/DATA_DICTIONARY.md` -
column names are case-sensitive and must match exactly (the pipeline does
not do fuzzy header matching the way the browser app's Import Wizard does).

## `InputDiscoveryError: ... missing required input file(s) ...`

`sales.csv`, `customers.csv`, and `reviews.csv` must all exist under the
input directory (`pipeline/sample_data/` by default). The pipeline doesn't
run with a subset of the three files.

## `JoinIntegrityError: ... produced zero rows ...`

`sales.csv` had zero rows after cleaning. Check `01_validation_report.json`
and `02_dedupe_report.json` in the output directory for that logical date
to see what was removed and why.

## Graph diagram not rendering as a real Airflow UI screenshot

`airflow dags show --save dag.png` requires the system `dot` (graphviz)
binary. On the machine this feature was built on, `dot` was not installed
and there was no passwordless `sudo` to install it. The fallback -
`scripts/render_dag_diagram.py` - reads the real DAG's `task_dict` via
Airflow's `DagBag` and renders the actual structure as SVG/DOT without
graphviz. If your machine has graphviz, `airflow dags show insightforge_etl
--save docs/media/dag_graph.png` will give you the native Airflow-rendered
version instead.

## Memory pressure running `airflow standalone`

`airflow standalone` starts a webserver + scheduler + triggerer in one
process and needs meaningfully more RAM than the lightweight commands used
in `QUICKSTART.md` (`airflow dags test`, `airflow dags list-import-errors`).
If your machine is memory-constrained (this pipeline was built and verified
on a machine with well under 1GB free RAM at times), prefer `airflow dags
test <dag_id> <date>` for verification - it runs the full DAG synchronously
in-process with no persistent daemons, and was the primary way this DAG was
actually validated. If `airflow standalone` hangs or the machine becomes
unresponsive, kill it (`Ctrl+C`) and fall back to `dags test`.

## Docker build/run issues

The `Dockerfile`/`docker-compose.yaml` were authored on a machine without
Docker installed and have not been build-tested there - see the honesty
disclosure in `QUICKSTART.md`. If `docker compose up` fails, the Python/venv
path in `QUICKSTART.md`'s Path B is the verified fallback and exercises
identical pipeline code (`transforms/`, `dags/`) - only the packaging
differs.

## Resetting to a clean slate

```bash
rm -rf pipeline/.airflow-home pipeline/output
```

`sample_data/` is committed and static, so nothing else needs resetting.

## Tests failing after a code change

Run `python -m pytest tests/ -v` from `pipeline/` for full output. Unit
tests (`tests/unit/`) isolate individual `transforms/*.py` modules with
small in-memory fixtures; `tests/test_dag_import.py` checks the DAG parses
and its task graph matches spec; `tests/test_full_pipeline_e2e.py` runs the
whole thing against the real `sample_data/` twice to check idempotency;
`tests/test_xcom_size_guard.py` guards against accidentally passing large
data through XCom.
