"""Small, hand-built DataFrames with known-correct expected results, shared
across the test modules. Deliberately tiny and independent of
data_generator.py output so tests stay fast and deterministic.
"""
from __future__ import annotations

import pandas as pd


def orders_with_known_quality_issues() -> pd.DataFrame:
    """8 hand-built order rows with exactly:
      - 1 exact duplicate row (row 1 duplicated as row 8)
      - 2 missing values (row 3 missing 'region', row 5 missing 'discount')
      - 1 negative value that should never be negative ('revenue' in row 6)
      - 1 clear IQR outlier in 'revenue' (row 7 revenue=5000 vs cluster ~50-120)
    """
    rows = [
        # 1
        {"orderId": "A1", "customerId": "C1", "date": "2024-01-01", "region": "North America",
         "revenue": 100.0, "quantity": 2, "discount": 0.0},
        # 2
        {"orderId": "A2", "customerId": "C2", "date": "2024-01-02", "region": "Europe",
         "revenue": 80.0, "quantity": 1, "discount": 0.1},
        # 3 - missing region
        {"orderId": "A3", "customerId": "C1", "date": "2024-01-03", "region": None,
         "revenue": 60.0, "quantity": 1, "discount": 0.0},
        # 4
        {"orderId": "A4", "customerId": "C3", "date": "2024-01-04", "region": "Asia Pacific",
         "revenue": 120.0, "quantity": 3, "discount": 0.05},
        # 5 - missing discount
        {"orderId": "A5", "customerId": "C2", "date": "2024-01-05", "region": "Europe",
         "revenue": 90.0, "quantity": 2, "discount": None},
        # 6 - negative revenue (data entry error)
        {"orderId": "A6", "customerId": "C4", "date": "2024-01-06", "region": "North America",
         "revenue": -50.0, "quantity": 1, "discount": 0.0},
        # 7 - IQR outlier
        {"orderId": "A7", "customerId": "C5", "date": "2024-01-07", "region": "Latin America",
         "revenue": 5000.0, "quantity": 1, "discount": 0.0},
        # 8 - exact duplicate of row 1
        {"orderId": "A1", "customerId": "C1", "date": "2024-01-01", "region": "North America",
         "revenue": 100.0, "quantity": 2, "discount": 0.0},
    ]
    return pd.DataFrame(rows)


def rfm_known_customers() -> pd.DataFrame:
    """Order-level rows for 4 customers with hand-picked recency/frequency/
    monetary values chosen to land squarely in specific score bands under
    DEFAULT_RFM_THRESHOLDS, so the resulting segment is unambiguous.

    Reference date used in tests: 2024-04-01.

    - CUST_CHAMPION: 6 orders, last on 2024-03-25 (7 days recency -> R=4),
      6 orders (F=4), monetary well over 500 (M=4) -> rfmScore=12 -> Champions
    - CUST_LOST: 1 order on 2023-01-01 (>180 days recency -> R=1), 1 order
      (F=1), monetary=20 (M=1) -> rfmScore=3 -> Lost
    - CUST_AT_RISK: last order ~204 days before reference (R=1), 2 orders
      (F=2), monetary=60 (M=2) -> rfmScore=5 -> At Risk
    - CUST_LOYAL: last order 10 days ago (R=4), 3 orders (F=3), monetary=250
      (M=3) -> rfmScore=10 -> Champions band edge check handled in test
    """
    rows = []
    # CUST_CHAMPION: 6 orders, each revenue=150, most recent 2024-03-25
    champion_dates = ["2024-01-05", "2024-01-20", "2024-02-05", "2024-02-20", "2024-03-10", "2024-03-25"]
    for d in champion_dates:
        rows.append({"customerId": "CUST_CHAMPION", "date": d, "revenue": 150.0})

    # CUST_LOST: single old, small order
    rows.append({"customerId": "CUST_LOST", "date": "2023-01-01", "revenue": 20.0})

    # CUST_AT_RISK: 2 orders, both long ago, small monetary
    rows.append({"customerId": "CUST_AT_RISK", "date": "2023-09-01", "revenue": 30.0})
    rows.append({"customerId": "CUST_AT_RISK", "date": "2023-09-10", "revenue": 30.0})

    # CUST_LOYAL: 3 recent-ish orders totaling 250
    rows.append({"customerId": "CUST_LOYAL", "date": "2024-03-01", "revenue": 100.0})
    rows.append({"customerId": "CUST_LOYAL", "date": "2024-03-15", "revenue": 100.0})
    rows.append({"customerId": "CUST_LOYAL", "date": "2024-03-22", "revenue": 50.0})

    return pd.DataFrame(rows)


def linear_series() -> pd.DataFrame:
    """A perfectly linear series: revenue = 10 + 5*day, days 0..9.
    Slope and intercept are exactly known, so trend-fit assertions can use
    exact equality (within floating point tolerance).
    """
    days = list(range(10))
    revenue = [10.0 + 5.0 * d for d in days]
    return pd.DataFrame({"dayOffset": days, "revenue": revenue})


def noisy_but_trending_series() -> pd.DataFrame:
    """A series with a known underlying linear trend (revenue = 100 + 2*day)
    plus a small fixed zig-zag perturbation, used to check that
    moving_average smooths without changing the overall trend direction.
    """
    days = list(range(12))
    base = [100.0 + 2.0 * d for d in days]
    # deterministic zig-zag noise, not random, so the test is fully fixed
    noise = [5, -5, 5, -5, 5, -5, 5, -5, 5, -5, 5, -5]
    revenue = [b + n for b, n in zip(base, noise)]
    return pd.DataFrame({"dayOffset": days, "revenue": revenue})
