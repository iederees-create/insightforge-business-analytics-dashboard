"""Task 2: validate_schema - checks required columns, missing values, and dtypes.

Hard failure (raises SchemaValidationError): a required column is entirely
absent, or a file has zero parseable rows. Soft failure (recorded in the
report, pipeline continues): missing values in an optional column,
malformed dates/numbers - mirrors the dashboard's own philosophy of never
crashing on missing optional data, flagging it instead
(src/lib/quality/checks.ts).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from transforms.io_utils import atomic_write_json
from transforms.logging_utils import SchemaValidationError, get_logger
from transforms.schema import SCHEMAS, date_columns, numeric_columns, required_columns

logger = get_logger("validate")


def read_raw_csv(path: str | Path) -> pd.DataFrame:
    """Reads an input CSV as all-string columns, skipping '#' disclaimer lines."""
    return pd.read_csv(path, comment="#", dtype=str, keep_default_na=False)


@dataclass(frozen=True)
class FileValidation:
    row_count: int
    missing_columns: list[str]
    missing_value_counts: dict[str, int]
    type_violations: dict[str, int]
    passed: bool


@dataclass(frozen=True)
class ValidationResult:
    logical_date: str
    output_dir: str
    report_path: str
    passed: bool
    per_file: dict[str, FileValidation]

    def to_xcom_dict(self) -> dict:
        return {
            "logicalDate": self.logical_date,
            "outputDir": self.output_dir,
            "reportPath": self.report_path,
            "passed": self.passed,
            "perFile": {
                name: {
                    "rowCount": v.row_count,
                    "missingColumns": v.missing_columns,
                    "missingValueCounts": v.missing_value_counts,
                    "typeViolations": v.type_violations,
                    "passed": v.passed,
                }
                for name, v in self.per_file.items()
            },
        }


def _validate_file(dataset: str, path: str) -> FileValidation:
    df = read_raw_csv(path)
    expected_columns = [c.name for c in SCHEMAS[dataset]]
    missing_columns = [c for c in required_columns(dataset) if c not in df.columns]

    missing_value_counts: dict[str, int] = {}
    for col in expected_columns:
        if col not in df.columns:
            continue
        missing_value_counts[col] = int((df[col].astype(str).str.strip() == "").sum())

    type_violations: dict[str, int] = {}
    for col in numeric_columns(dataset):
        if col not in df.columns:
            continue
        non_blank = df[col].astype(str).str.strip() != ""
        coerced = pd.to_numeric(df.loc[non_blank, col], errors="coerce")
        type_violations[col] = int(coerced.isna().sum())
    for col in date_columns(dataset):
        if col not in df.columns:
            continue
        non_blank = df[col].astype(str).str.strip() != ""
        coerced = pd.to_datetime(df.loc[non_blank, col], format="mixed", errors="coerce")
        type_violations[col] = int(coerced.isna().sum())

    passed = len(missing_columns) == 0 and len(df) > 0
    return FileValidation(
        row_count=len(df),
        missing_columns=missing_columns,
        missing_value_counts=missing_value_counts,
        type_violations=type_violations,
        passed=passed,
    )


def validate_schema_impl(manifest: dict) -> ValidationResult:
    out_dir = Path(manifest["outputDir"])
    per_file: dict[str, FileValidation] = {}
    hard_failures: list[str] = []

    for dataset, entry in manifest["files"].items():
        validation = _validate_file(dataset, entry["path"])
        per_file[dataset] = validation
        if not validation.passed:
            if validation.missing_columns:
                hard_failures.append(f"{dataset}.csv is missing required column(s): {validation.missing_columns}")
            elif validation.row_count == 0:
                hard_failures.append(f"{dataset}.csv has zero parseable rows")

    report_path = out_dir / "01_validation_report.json"
    result = ValidationResult(
        logical_date=manifest["logicalDate"],
        output_dir=str(out_dir),
        report_path=str(report_path),
        passed=len(hard_failures) == 0,
        per_file=per_file,
    )
    atomic_write_json(report_path, result.to_xcom_dict())

    if hard_failures:
        raise SchemaValidationError(
            "validate_schema failed: " + "; ".join(hard_failures) + " - see docs/TROUBLESHOOTING.md#schema-validation-errors."
        )

    logger.info("Schema validation passed for %d file(s)", len(per_file))
    return result
