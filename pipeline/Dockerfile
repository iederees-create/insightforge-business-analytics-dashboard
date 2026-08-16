# InsightForge ETL pipeline - optional Docker setup.
#
# NOTE (honesty disclosure - see docs/QUICKSTART.md): this Dockerfile and
# docker-compose.yaml were authored on a machine without Docker installed,
# so they have NOT been build/run-tested in this environment. The pipeline
# itself has been validated another way: the exact same pinned Airflow
# version was installed in a local virtualenv and exercised via
# `airflow dags list-import-errors`, `airflow dags test`, and the standalone
# CLI (python -m cli.run_pipeline) - all passing. If `docker compose up`
# surfaces an issue this indirect validation didn't catch, see
# docs/TROUBLESHOOTING.md.
FROM apache/airflow:2.10.5-python3.12

USER root
# Nothing extra needed at the OS layer - inputs/outputs are local CSV/JSON
# files only, so no database client libraries or credentials are required.
USER airflow

WORKDIR /opt/airflow

COPY requirements.txt /opt/airflow/pipeline-requirements.txt
RUN pip install --no-cache-dir \
    -r /opt/airflow/pipeline-requirements.txt \
    --constraint https://raw.githubusercontent.com/apache/airflow/constraints-2.10.5/constraints-3.12.txt

COPY pyproject.toml /opt/airflow/pipeline/pyproject.toml
COPY dags /opt/airflow/pipeline/dags
COPY transforms /opt/airflow/pipeline/transforms
COPY cli /opt/airflow/pipeline/cli
COPY sample_data /opt/airflow/pipeline/sample_data

ENV AIRFLOW__CORE__DAGS_FOLDER=/opt/airflow/pipeline/dags
ENV PYTHONPATH=/opt/airflow/pipeline
