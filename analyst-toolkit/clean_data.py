"""Data cleaning + data-quality reporting for InsightForge CSV exports.

Understands the shared CSV schema used by both the InsightForge web app and
this toolkit:

    date, orderId, transactionId, customerId, customerName, product,
    category, quantity, revenue, cost, profit, discount, channel, region,
    country, latitude, longitude, rating, reviewText, marketingSource,
    campaign, status

Not every column is required. All functions here check for column presence
before analyzing it and skip (with a clear note) anything that isn't
present, rather than crashing or reporting misleading zeros.

Usage as a script:

    python clean_data.py sample_data/orders.csv

Usage as a module:

    from clean_data import load_csv, clean_dataframe
    df = load_csv("sample_data/orders.csv")
    cleaned_df, summary = clean_dataframe(df)
    print(summary)

Cleaning never mutates the input DataFrame in place -- every function that
"cleans" data returns a brand-new DataFrame.
"""
from __future__ import annotations

import sys
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

# Columns that should never logically be negative. Used both for the
# negative-value check and the IQR outlier check.
NON_NEGATIVE_COLUMNS = ["quantity", "revenue", "cost", "discount", "rating"]

# Columns worth checking for statistical outliers (IQR method). Profit is
# intentionally excluded from NON_NEGATIVE_COLUMNS (it can legitimately be
# negative on a loss-making order) but is still worth an outlier scan.
OUTLIER_CANDIDATE_COLUMNS = ["quantity", "revenue", "cost", "profit", "discount"]


def load_csv(path: str) -> pd.DataFrame:
    """Load a CSV that follows the shared InsightForge schema.

    Tolerates the '# ...' synthetic-data disclaimer header lines written by
    data_generator.py, and parses the `date` column as datetime when present.
    """
    df = pd.read_csv(path, comment="#")
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
    return df


@dataclass
class MissingValueReport:
    counts: dict[str, int] = field(default_factory=dict)

    @property
    def total(self) -> int:
        return sum(self.counts.values())


def find_missing_values(df: pd.DataFrame) -> MissingValueReport:
    """Count nulls per column. Columns entirely absent from the DataFrame
    are simply not present in the report (nothing to report on them)."""
    counts = {col: int(df[col].isna().sum()) for col in df.columns if df[col].isna().sum() > 0}
    return MissingValueReport(counts=counts)


def find_duplicate_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Return the exact duplicate rows (all columns identical), keeping
    every occurrence after the first so the caller can see what would be
    dropped."""
    return df[df.duplicated(keep="first")]


def find_negative_values(df: pd.DataFrame) -> dict[str, int]:
    """Count rows with a negative value in columns that should never be
    negative (quantity, revenue, cost, discount, rating). Only checks
    columns that are actually present in this dataset."""
    result: dict[str, int] = {}
    for col in NON_NEGATIVE_COLUMNS:
        if col not in df.columns:
            continue
        numeric = pd.to_numeric(df[col], errors="coerce")
        n_negative = int((numeric < 0).sum())
        if n_negative > 0:
            result[col] = n_negative
    return result


def find_outliers_iqr(df: pd.DataFrame, columns: list[str] | None = None) -> dict[str, dict[str, float | int]]:
    """Detect outliers using the classic IQR fence: values outside
    [Q1 - 1.5*IQR, Q3 + 1.5*IQR] are flagged. Returns, per column, the
    bounds used and how many rows fall outside them.
    """
    candidate_columns = columns if columns is not None else OUTLIER_CANDIDATE_COLUMNS
    report: dict[str, dict[str, float | int]] = {}
    for col in candidate_columns:
        if col not in df.columns:
            continue
        numeric = pd.to_numeric(df[col], errors="coerce").dropna()
        if len(numeric) < 4:
            continue  # not enough data to compute meaningful quartiles
        q1, q3 = numeric.quantile(0.25), numeric.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        n_outliers = int(((numeric < lower_bound) | (numeric > upper_bound)).sum())
        if n_outliers > 0:
            report[col] = {
                "lower_bound": round(float(lower_bound), 2),
                "upper_bound": round(float(upper_bound), 2),
                "count": n_outliers,
            }
    return report


def clean_dataframe(df: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    """Produce a cleaned copy of `df` plus a plain-text summary of exactly
    what changed and why. The input DataFrame is never modified.

    Cleaning steps (conservative by design -- this is a reporting/demo
    toolkit, not an automated data-repair pipeline):
      1. Drop exact duplicate rows (keep first occurrence).
      2. Convert negative values in columns that can never logically be
         negative (quantity, revenue, cost, discount, rating) to NaN --
         they are treated as data-entry errors, not truths to keep.
      3. Missing values and IQR outliers are reported but NOT auto-removed
         or auto-imputed, since guessing a business's discount codes or
         legitimate high-value orders can silently distort analysis.
    """
    lines: list[str] = ["Data Cleaning Summary", "=" * 22, ""]

    missing_before = find_missing_values(df)
    duplicates = find_duplicate_rows(df)
    negatives = find_negative_values(df)
    outliers = find_outliers_iqr(df)

    cleaned = df.copy()

    # Step 1: drop exact duplicate rows.
    n_dupes = len(duplicates)
    if n_dupes:
        cleaned = cleaned.drop_duplicates(keep="first").reset_index(drop=True)
        lines.append(f"- Removed {n_dupes} exact duplicate row(s) (kept first occurrence).")
    else:
        lines.append("- No exact duplicate rows found.")

    # Step 2: negative values in columns that should never be negative.
    if negatives:
        for col, count in negatives.items():
            numeric = pd.to_numeric(cleaned[col], errors="coerce")
            mask = numeric < 0
            cleaned.loc[mask, col] = np.nan
            lines.append(
                f"- Column '{col}': {count} negative value(s) treated as data-entry errors "
                f"and set to missing (NaN), since '{col}' cannot logically be negative."
            )
    else:
        lines.append("- No invalid negative values found in quantity/revenue/cost/discount/rating.")

    # Step 3: report (do not modify) missing values.
    if missing_before.counts:
        lines.append("- Missing values detected (left as-is; not auto-filled to avoid inventing data):")
        for col, count in sorted(missing_before.counts.items(), key=lambda kv: -kv[1]):
            pct = 100 * count / len(df) if len(df) else 0
            lines.append(f"    - '{col}': {count} missing ({pct:.1f}% of rows)")
    else:
        lines.append("- No missing values found.")

    # Step 3b: report (do not remove) IQR outliers.
    if outliers:
        lines.append("- Statistical outliers detected via IQR method (reported only, not removed):")
        for col, info in outliers.items():
            lines.append(
                f"    - '{col}': {info['count']} value(s) outside "
                f"[{info['lower_bound']}, {info['upper_bound']}]"
            )
        lines.append(
            "  Outliers are left in the cleaned data by default -- in real business data these "
            "are often legitimate large orders, not errors. Review manually before excluding."
        )
    else:
        lines.append("- No statistical outliers found (IQR method) in the checked numeric columns.")

    lines.append("")
    lines.append(f"Rows before cleaning: {len(df)}")
    lines.append(f"Rows after cleaning:  {len(cleaned)}")

    return cleaned, "\n".join(lines)


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("Usage: python clean_data.py <path/to/file.csv>")
        return 1

    path = argv[1]
    try:
        df = load_csv(path)
    except FileNotFoundError:
        print(f"Error: file not found: {path}")
        return 1
    except pd.errors.EmptyDataError:
        print(f"Error: '{path}' is empty or not a valid CSV.")
        return 1

    if df.empty:
        print(f"'{path}' loaded but contains no rows. Nothing to clean.")
        return 0

    _cleaned, summary = clean_dataframe(df)
    print(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
