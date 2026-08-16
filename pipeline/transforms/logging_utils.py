"""Structured logging and task-specific exceptions for the InsightForge pipeline.

Every exception carries the offending file/column/count in its message so
Airflow task logs (and `airflow dags test` output) are directly diagnostic
rather than a bare traceback - see docs/TROUBLESHOOTING.md.
"""

from __future__ import annotations

import logging


def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(f"insightforge_pipeline.{name}")
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s"))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger


class PipelineError(Exception):
    """Base class for pipeline task failures with an actionable message."""


class InputDiscoveryError(PipelineError):
    """Raised by discover_inputs when a required input file is missing."""


class SchemaValidationError(PipelineError):
    """Raised by validate_schema when a required column or all rows are missing."""


class JoinIntegrityError(PipelineError):
    """Raised by join_datasets when the join produces no rows at all."""
