"""Shared analysis math used by both the notebooks and the pytest suite.

Keeping the RFM segmentation and forecasting calculations here (instead of
copy-pasted into notebook cells) means the same tested code path runs in
both places, per the DRY principle.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# RFM (Recency / Frequency / Monetary) customer segmentation
# ---------------------------------------------------------------------------

#: Default scoring thresholds. Deliberately explicit (not quantile-based)
#: so behavior is stable and easy to reason about/test regardless of how
#: many customers are in the dataset. Buyers can override these to match
#: their own business's order cadence and order values.
DEFAULT_RFM_THRESHOLDS = {
    # Recency: days since last order. Lower is better -> higher score.
    "recency_days": {4: 30, 3: 90, 2: 180},  # score: max days for that score; else score 1
    # Frequency: number of orders. Higher is better -> higher score.
    "frequency": {4: 5, 3: 3, 2: 2},  # score: min orders for that score; else score 1
    # Monetary: total revenue. Higher is better -> higher score.
    "monetary": {4: 500.0, 3: 200.0, 2: 50.0},  # score: min revenue for that score; else score 1
}

#: Maps a combined R+F+M score (range 3-12) to a human-readable segment.
DEFAULT_SEGMENT_BANDS = [
    (10, 12, "Champions"),
    (8, 9, "Loyal Customers"),
    (6, 7, "Potential Loyalists"),
    (4, 5, "At Risk"),
    (3, 3, "Lost"),
]


def _score_recency(days: float, thresholds: dict[int, float]) -> int:
    if days <= thresholds[4]:
        return 4
    if days <= thresholds[3]:
        return 3
    if days <= thresholds[2]:
        return 2
    return 1


def _score_ascending(value: float, thresholds: dict[int, float]) -> int:
    """Higher value -> higher score (used for frequency and monetary)."""
    if value >= thresholds[4]:
        return 4
    if value >= thresholds[3]:
        return 3
    if value >= thresholds[2]:
        return 2
    return 1


def _segment_for_score(total_score: int, bands: list[tuple[int, int, str]]) -> str:
    for low, high, label in bands:
        if low <= total_score <= high:
            return label
    return "Unclassified"


def compute_rfm(
    orders: pd.DataFrame,
    reference_date: pd.Timestamp | None = None,
    thresholds: dict | None = None,
    segment_bands: list[tuple[int, int, str]] | None = None,
) -> pd.DataFrame:
    """Compute per-customer Recency/Frequency/Monetary metrics and a segment
    label.

    Parameters
    ----------
    orders: must contain `customerId`, `date`, and `revenue` columns.
    reference_date: the "as of" date recency is measured against. Defaults
        to the max date found in `orders`.
    thresholds: overrides for DEFAULT_RFM_THRESHOLDS.
    segment_bands: overrides for DEFAULT_SEGMENT_BANDS.

    Returns a DataFrame indexed by customerId with columns:
        recencyDays, frequency, monetary, rScore, fScore, mScore,
        rfmScore, segment
    """
    required = {"customerId", "date", "revenue"}
    missing = required - set(orders.columns)
    if missing:
        raise ValueError(f"compute_rfm requires columns {sorted(required)}; missing {sorted(missing)}")

    thresholds = thresholds or DEFAULT_RFM_THRESHOLDS
    segment_bands = segment_bands or DEFAULT_SEGMENT_BANDS

    df = orders.copy()
    df["date"] = pd.to_datetime(df["date"])
    if reference_date is None:
        reference_date = df["date"].max()
    else:
        reference_date = pd.to_datetime(reference_date)

    grouped = df.groupby("customerId").agg(
        lastOrderDate=("date", "max"),
        frequency=("date", "count"),
        monetary=("revenue", "sum"),
    )
    grouped["recencyDays"] = (reference_date - grouped["lastOrderDate"]).dt.days

    grouped["rScore"] = grouped["recencyDays"].apply(lambda d: _score_recency(d, thresholds["recency_days"]))
    grouped["fScore"] = grouped["frequency"].apply(lambda f: _score_ascending(f, thresholds["frequency"]))
    grouped["mScore"] = grouped["monetary"].apply(lambda m: _score_ascending(m, thresholds["monetary"]))
    grouped["rfmScore"] = grouped["rScore"] + grouped["fScore"] + grouped["mScore"]
    grouped["segment"] = grouped["rfmScore"].apply(lambda s: _segment_for_score(int(s), segment_bands))

    return grouped.drop(columns=["lastOrderDate"]).reset_index()


# ---------------------------------------------------------------------------
# Forecasting: simple, transparent moving-average + linear-trend extrapolation
# (deliberately not a black-box model -- see notebook 04 for the rationale)
# ---------------------------------------------------------------------------


def moving_average(values: pd.Series | np.ndarray, window: int) -> np.ndarray:
    """Simple trailing moving average. The first `window - 1` entries are
    NaN because there isn't enough history yet to compute a full window.
    """
    if window < 1:
        raise ValueError("window must be >= 1")
    series = pd.Series(values, dtype="float64")
    return series.rolling(window=window, min_periods=window).mean().to_numpy()


@dataclass(frozen=True)
class LinearTrend:
    slope: float
    intercept: float

    def predict(self, x: np.ndarray) -> np.ndarray:
        return self.slope * np.asarray(x, dtype="float64") + self.intercept


def fit_linear_trend(x: pd.Series | np.ndarray, y: pd.Series | np.ndarray) -> LinearTrend:
    """Ordinary least-squares linear fit (degree-1 polynomial). `x` is
    expected to be a numeric index (e.g. day offsets from the first date),
    not a datetime.
    """
    x_arr = np.asarray(x, dtype="float64")
    y_arr = np.asarray(y, dtype="float64")
    if len(x_arr) < 2:
        raise ValueError("fit_linear_trend needs at least 2 data points")
    slope, intercept = np.polyfit(x_arr, y_arr, deg=1)
    return LinearTrend(slope=float(slope), intercept=float(intercept))


def forecast_linear_trend(
    x: pd.Series | np.ndarray, y: pd.Series | np.ndarray, periods_ahead: int
) -> tuple[LinearTrend, np.ndarray, np.ndarray]:
    """Fit a linear trend to (x, y) and extrapolate `periods_ahead` steps
    beyond the last x value (assuming x is evenly spaced, e.g. day offsets).

    Returns (fitted_trend, future_x, forecast_y).
    """
    trend = fit_linear_trend(x, y)
    x_arr = np.asarray(x, dtype="float64")
    step = 1.0 if len(x_arr) < 2 else float(np.median(np.diff(np.sort(x_arr))))
    last_x = float(x_arr.max())
    future_x = last_x + step * np.arange(1, periods_ahead + 1)
    forecast_y = trend.predict(future_x)
    return trend, future_x, forecast_y


def residual_std(x: pd.Series | np.ndarray, y: pd.Series | np.ndarray, trend: LinearTrend) -> float:
    """Standard deviation of residuals (actual - predicted), used as a
    simple, transparent stand-in for a forecast uncertainty band. This is
    NOT a formal confidence interval -- see notebook 04's Limitations
    section.
    """
    x_arr = np.asarray(x, dtype="float64")
    y_arr = np.asarray(y, dtype="float64")
    residuals = y_arr - trend.predict(x_arr)
    return float(np.std(residuals, ddof=1)) if len(residuals) > 1 else 0.0
