"""Tests for clean_data.py -- verifies the actual detection/cleaning math
against small fixed fixtures with known expected results.
"""
from __future__ import annotations

import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from clean_data import (
    clean_dataframe,
    find_duplicate_rows,
    find_missing_values,
    find_negative_values,
    find_outliers_iqr,
)
from tests.fixtures import orders_with_known_quality_issues


def test_find_missing_values_counts_known_nulls():
    df = orders_with_known_quality_issues()
    report = find_missing_values(df)
    assert report.counts == {"region": 1, "discount": 1}
    assert report.total == 2


def test_find_missing_values_empty_when_no_nulls():
    df = pd.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]})
    report = find_missing_values(df)
    assert report.counts == {}
    assert report.total == 0


def test_find_duplicate_rows_flags_exact_duplicate():
    df = orders_with_known_quality_issues()
    duplicates = find_duplicate_rows(df)
    assert len(duplicates) == 1
    assert duplicates.iloc[0]["orderId"] == "A1"


def test_find_duplicate_rows_empty_when_all_unique():
    df = pd.DataFrame({"a": [1, 2, 3]})
    assert len(find_duplicate_rows(df)) == 0


def test_find_negative_values_flags_only_true_negatives():
    df = orders_with_known_quality_issues()
    negatives = find_negative_values(df)
    assert negatives == {"revenue": 1}


def test_find_negative_values_ignores_columns_not_present():
    df = pd.DataFrame({"quantity": [1, 2, 3]})
    negatives = find_negative_values(df)
    assert negatives == {}


def test_find_outliers_iqr_flags_known_outliers():
    # Revenue values: 100, 80, 60, 120, 90, -50, 5000, 100 (dup of row 1).
    # Q1=75, Q3=105, IQR=30 -> fence is [30, 150]. Both -50 (the negative
    # data-entry error) and 5000 (the deliberate spike) fall outside it,
    # so both are correctly flagged as statistical outliers.
    df = orders_with_known_quality_issues()
    outliers = find_outliers_iqr(df, columns=["revenue"])
    assert "revenue" in outliers
    assert outliers["revenue"]["lower_bound"] == 30.0
    assert outliers["revenue"]["upper_bound"] == 150.0
    assert outliers["revenue"]["count"] == 2


def test_find_outliers_iqr_skips_columns_with_too_few_points():
    df = pd.DataFrame({"revenue": [10.0, 20.0]})
    outliers = find_outliers_iqr(df, columns=["revenue"])
    assert outliers == {}


def test_find_outliers_iqr_skips_missing_column_gracefully():
    df = pd.DataFrame({"quantity": [1, 2, 3, 4, 5]})
    # 'revenue' isn't present -- must not raise, must simply be absent.
    outliers = find_outliers_iqr(df, columns=["revenue"])
    assert outliers == {}


def test_clean_dataframe_drops_exact_duplicates_only():
    df = orders_with_known_quality_issues()
    cleaned, _summary = clean_dataframe(df)
    assert len(cleaned) == len(df) - 1  # exactly the one duplicate removed
    assert cleaned["orderId"].tolist().count("A1") == 1


def test_clean_dataframe_does_not_mutate_input():
    df = orders_with_known_quality_issues()
    original_len = len(df)
    original_revenue = df["revenue"].copy()
    clean_dataframe(df)
    assert len(df) == original_len
    pd.testing.assert_series_equal(df["revenue"], original_revenue)


def test_clean_dataframe_converts_invalid_negative_to_nan():
    df = orders_with_known_quality_issues()
    cleaned, _summary = clean_dataframe(df)
    negative_row = cleaned[cleaned["orderId"] == "A6"]
    assert negative_row["revenue"].isna().all()


def test_clean_dataframe_leaves_outliers_in_place():
    df = orders_with_known_quality_issues()
    cleaned, _summary = clean_dataframe(df)
    outlier_row = cleaned[cleaned["orderId"] == "A7"]
    assert outlier_row["revenue"].iloc[0] == 5000.0


def test_clean_dataframe_summary_mentions_key_findings():
    df = orders_with_known_quality_issues()
    _cleaned, summary = clean_dataframe(df)
    assert "duplicate" in summary.lower()
    assert "region" in summary
    assert "discount" in summary
    assert "revenue" in summary


def test_clean_dataframe_handles_dataset_with_no_issues():
    df = pd.DataFrame(
        {
            "orderId": ["B1", "B2", "B3", "B4", "B5"],
            "revenue": [10.0, 20.0, 30.0, 40.0, 50.0],
        }
    )
    cleaned, summary = clean_dataframe(df)
    assert len(cleaned) == len(df)
    assert "No exact duplicate rows found." in summary
    assert "No missing values found." in summary
