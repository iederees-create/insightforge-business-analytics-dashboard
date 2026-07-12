"""Tests for the forecasting math in analysis_utils.py -- known input,
known trend/moving-average output. Tests the calculation itself, not just
"it runs".
"""
from __future__ import annotations

import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analysis_utils import fit_linear_trend, forecast_linear_trend, moving_average, residual_std
from tests.fixtures import linear_series, noisy_but_trending_series


def test_moving_average_known_window():
    values = [1, 2, 3, 4, 5, 6]
    result = moving_average(values, window=3)
    # First 2 entries have insufficient history -> NaN.
    assert np.isnan(result[0])
    assert np.isnan(result[1])
    # 3-point trailing averages: (1+2+3)/3=2, (2+3+4)/3=3, ...
    expected = [np.nan, np.nan, 2.0, 3.0, 4.0, 5.0]
    for actual, exp in zip(result, expected):
        if np.isnan(exp):
            assert np.isnan(actual)
        else:
            assert actual == pytest.approx(exp)


def test_moving_average_window_of_one_returns_original_series():
    values = [5, 10, 15]
    result = moving_average(values, window=1)
    assert list(result) == [5.0, 10.0, 15.0]


def test_moving_average_rejects_invalid_window():
    with pytest.raises(ValueError):
        moving_average([1, 2, 3], window=0)


def test_moving_average_smooths_zigzag_but_preserves_trend_direction():
    df = noisy_but_trending_series()
    smoothed = moving_average(df["revenue"], window=4)
    valid = smoothed[~np.isnan(smoothed)]
    # Underlying trend is +2/day; a 4-point average of the zig-zag noise
    # should be monotonically non-decreasing since the noise pattern
    # repeats every 2 steps and washes out over a 4-point window.
    assert all(b >= a - 1e-9 for a, b in zip(valid, valid[1:]))


def test_fit_linear_trend_recovers_exact_slope_and_intercept():
    df = linear_series()  # revenue = 10 + 5*day, exactly
    trend = fit_linear_trend(df["dayOffset"], df["revenue"])
    assert trend.slope == pytest.approx(5.0, abs=1e-9)
    assert trend.intercept == pytest.approx(10.0, abs=1e-9)


def test_fit_linear_trend_predict_matches_known_points():
    df = linear_series()
    trend = fit_linear_trend(df["dayOffset"], df["revenue"])
    predicted = trend.predict(np.array([0, 5, 9]))
    assert predicted[0] == pytest.approx(10.0)
    assert predicted[1] == pytest.approx(35.0)
    assert predicted[2] == pytest.approx(55.0)


def test_fit_linear_trend_requires_at_least_two_points():
    with pytest.raises(ValueError):
        fit_linear_trend([0], [10.0])


def test_forecast_linear_trend_extrapolates_correct_future_values():
    df = linear_series()  # revenue = 10 + 5*day for day 0..9
    trend, future_x, forecast_y = forecast_linear_trend(df["dayOffset"], df["revenue"], periods_ahead=3)
    # Next days are 10, 11, 12 -> revenue should be 60, 65, 70
    assert list(future_x) == [10.0, 11.0, 12.0]
    assert forecast_y[0] == pytest.approx(60.0)
    assert forecast_y[1] == pytest.approx(65.0)
    assert forecast_y[2] == pytest.approx(70.0)
    assert trend.slope == pytest.approx(5.0)


def test_residual_std_is_zero_for_perfectly_linear_data():
    df = linear_series()
    trend = fit_linear_trend(df["dayOffset"], df["revenue"])
    assert residual_std(df["dayOffset"], df["revenue"], trend) == pytest.approx(0.0, abs=1e-9)


def test_residual_std_is_positive_for_noisy_data():
    df = noisy_but_trending_series()
    trend = fit_linear_trend(df["dayOffset"], df["revenue"])
    spread = residual_std(df["dayOffset"], df["revenue"], trend)
    assert spread > 0.0
