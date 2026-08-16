"""Task 3: clean_and_deduplicate - standardises types/text and removes exact duplicates.

Mirrors the dashboard's own cleaning philosophy (src/lib/quality/score.ts
applyCleaning): never silently drop rows for a soft data-quality issue by
default, never mutate the raw input in place, and record every step taken
so the transformation is explainable. Dedup runs against the RAW input each
time (not against a previous run's cleaned output) so reruns don't compound.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from transforms.io_utils import atomic_write_json
from transforms.logging_utils import get_logger
from transforms.schema import date_columns, integer_columns, numeric_columns
from transforms.validate import read_raw_csv

logger = get_logger("clean")

TEXT_STRIP_COLUMNS = {"product", "category", "customerName", "channel", "region", "country", "reviewText"}


def _standardize_text(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for col in TEXT_STRIP_COLUMNS & set(df.columns):
        df[col] = df[col].astype(str).str.strip().str.replace(r"\s{2,}", " ", regex=True)
    return df


def _canonicalize_category_casing(df: pd.DataFrame, column: str = "category") -> tuple[pd.DataFrame, int]:
    """Collapses case/whitespace variants of the same label (e.g. 'Home' vs 'home ')
    to whichever variant is most frequent, so downstream grouping/rankings aren't
    fragmented by data-entry inconsistency."""
    if column not in df.columns:
        return df, 0
    df = df.copy()
    normalized = df[column].str.strip().str.lower()
    canonical_by_norm = df.assign(_norm=normalized).groupby("_norm")[column].agg(lambda s: s.value_counts().idxmax())

    new_values = []
    changed = 0
    for original, norm in zip(df[column], normalized):
        canonical = canonical_by_norm.get(norm, original)
        if canonical != original:
            changed += 1
        new_values.append(canonical)
    df[column] = new_values
    return df, changed


def _coerce_and_format(dataset: str, df: pd.DataFrame) -> pd.DataFrame:
    """Coerces numeric/date columns for correct dedup/downstream comparison, then
    re-formats them back to clean plain-text CSV values (invalid values become
    blank, never silently zero - matches docs/DATA_SCHEMA.md's coercion rules)."""
    df = df.copy()
    int_cols = set(integer_columns(dataset))
    for col in [c for c in numeric_columns(dataset) if c in df.columns]:
        coerced = pd.to_numeric(df[col].replace("", pd.NA), errors="coerce")
        if col in int_cols:
            df[col] = coerced.astype("Int64")
        else:
            df[col] = coerced
    for col in [c for c in date_columns(dataset) if c in df.columns]:
        coerced = pd.to_datetime(df[col].replace("", pd.NA), format="mixed", errors="coerce")
        df[col] = coerced.dt.strftime("%Y-%m-%d")
        df[col] = df[col].fillna("")
    return df


@dataclass(frozen=True)
class CleanResult:
    logical_date: str
    output_dir: str
    cleaned_paths: dict[str, str]
    dedupe_report_path: str
    rows_removed: dict[str, int]
    category_labels_standardized: int

    def to_xcom_dict(self) -> dict:
        return {
            "logicalDate": self.logical_date,
            "outputDir": self.output_dir,
            "cleanedPaths": self.cleaned_paths,
            "dedupeReportPath": self.dedupe_report_path,
            "rowsRemoved": self.rows_removed,
            "categoryLabelsStandardized": self.category_labels_standardized,
        }


def clean_and_deduplicate_impl(manifest: dict, validation: dict) -> CleanResult:
    out_dir = Path(manifest["outputDir"])
    cleaned_paths: dict[str, str] = {}
    rows_removed: dict[str, int] = {}
    duplicate_order_ids: dict[str, list[str]] = {}
    total_category_standardized = 0

    for dataset, entry in manifest["files"].items():
        df = read_raw_csv(entry["path"])
        df = _standardize_text(df)
        if "category" in df.columns:
            df, changed = _canonicalize_category_casing(df)
            total_category_standardized += changed
        df = _coerce_and_format(dataset, df)

        before = len(df)
        df = df.drop_duplicates(keep="first").reset_index(drop=True)
        rows_removed[dataset] = before - len(df)

        if "orderId" in df.columns:
            non_blank_order_id = df["orderId"].astype(str).str.strip() != ""
            dupe_mask = non_blank_order_id & df["orderId"].duplicated(keep=False)
            duplicate_order_ids[dataset] = sorted(df.loc[dupe_mask, "orderId"].unique().tolist())

        cleaned_path = out_dir / f"02_cleaned_{dataset}.csv"
        df.to_csv(cleaned_path, index=False)
        cleaned_paths[dataset] = str(cleaned_path)

    dedupe_report_path = out_dir / "02_dedupe_report.json"
    atomic_write_json(
        dedupe_report_path,
        {
            "exactDuplicateRowsRemoved": rows_removed,
            "duplicateOrderIds": duplicate_order_ids,
            "categoryLabelsStandardized": total_category_standardized,
            "note": (
                "Exact duplicate rows are removed automatically. Duplicate order IDs "
                "with different row content are reported but NOT auto-removed - they "
                "may be legitimate multi-line orders, so this is flagged for review "
                "rather than silently deleted (see docs/DATA_DICTIONARY.md)."
            ),
        },
    )

    result = CleanResult(
        logical_date=manifest["logicalDate"],
        output_dir=str(out_dir),
        cleaned_paths=cleaned_paths,
        dedupe_report_path=str(dedupe_report_path),
        rows_removed=rows_removed,
        category_labels_standardized=total_category_standardized,
    )
    logger.info("Cleaned %d dataset(s); exact duplicates removed: %s", len(cleaned_paths), rows_removed)
    return result
