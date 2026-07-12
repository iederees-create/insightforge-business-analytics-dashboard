"""Tests for the RFM segmentation math in analysis_utils.py -- known input,
known expected R/F/M scores and segment label.
"""
from __future__ import annotations

import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis_utils import compute_rfm
from tests.fixtures import rfm_known_customers

REFERENCE_DATE = pd.Timestamp("2024-04-01")


def test_compute_rfm_raises_on_missing_required_columns():
    df = pd.DataFrame({"customerId": ["C1"], "date": ["2024-01-01"]})  # no revenue
    try:
        compute_rfm(df)
    except ValueError as exc:
        assert "revenue" in str(exc)
    else:
        raise AssertionError("expected ValueError for missing 'revenue' column")


def test_compute_rfm_champion_customer():
    df = rfm_known_customers()
    rfm = compute_rfm(df, reference_date=REFERENCE_DATE).set_index("customerId")
    row = rfm.loc["CUST_CHAMPION"]
    assert row["recencyDays"] == 7
    assert row["frequency"] == 6
    assert row["monetary"] == 900.0
    assert row["rScore"] == 4
    assert row["fScore"] == 4
    assert row["mScore"] == 4
    assert row["rfmScore"] == 12
    assert row["segment"] == "Champions"


def test_compute_rfm_lost_customer():
    df = rfm_known_customers()
    rfm = compute_rfm(df, reference_date=REFERENCE_DATE).set_index("customerId")
    row = rfm.loc["CUST_LOST"]
    assert row["recencyDays"] == (REFERENCE_DATE - pd.Timestamp("2023-01-01")).days
    assert row["frequency"] == 1
    assert row["monetary"] == 20.0
    assert row["rScore"] == 1
    assert row["fScore"] == 1
    assert row["mScore"] == 1
    assert row["rfmScore"] == 3
    assert row["segment"] == "Lost"


def test_compute_rfm_at_risk_customer():
    df = rfm_known_customers()
    rfm = compute_rfm(df, reference_date=REFERENCE_DATE).set_index("customerId")
    row = rfm.loc["CUST_AT_RISK"]
    assert row["frequency"] == 2
    assert row["monetary"] == 60.0
    assert row["rScore"] == 1
    assert row["fScore"] == 2
    assert row["mScore"] == 2
    assert row["rfmScore"] == 5
    assert row["segment"] == "At Risk"


def test_compute_rfm_loyal_customer_lands_in_champions_band():
    df = rfm_known_customers()
    rfm = compute_rfm(df, reference_date=REFERENCE_DATE).set_index("customerId")
    row = rfm.loc["CUST_LOYAL"]
    assert row["recencyDays"] == 10
    assert row["frequency"] == 3
    assert row["monetary"] == 250.0
    assert row["rScore"] == 4
    assert row["fScore"] == 3
    assert row["mScore"] == 3
    assert row["rfmScore"] == 10
    assert row["segment"] == "Champions"


def test_compute_rfm_custom_thresholds_change_segment():
    df = rfm_known_customers()
    # Tighten the monetary bar so CUST_LOYAL's 250 no longer reaches M=3.
    strict_thresholds = {
        "recency_days": {4: 30, 3: 90, 2: 180},
        "frequency": {4: 5, 3: 3, 2: 2},
        "monetary": {4: 500.0, 3: 300.0, 2: 50.0},
    }
    rfm = compute_rfm(df, reference_date=REFERENCE_DATE, thresholds=strict_thresholds).set_index("customerId")
    row = rfm.loc["CUST_LOYAL"]
    assert row["mScore"] == 2  # 250 >= 50 but < 300 now
    assert row["rfmScore"] == 9
    assert row["segment"] == "Loyal Customers"


def test_compute_rfm_defaults_reference_date_to_max_order_date():
    df = rfm_known_customers()
    rfm = compute_rfm(df).set_index("customerId")  # no reference_date passed
    expected_reference = pd.to_datetime(df["date"]).max()
    row = rfm.loc["CUST_CHAMPION"]
    assert row["recencyDays"] == (expected_reference - pd.Timestamp("2024-03-25")).days
