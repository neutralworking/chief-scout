"""
Tests for calibration and benchmarking utilities.
"""

import pytest

from valuation_core.calibration.benchmarking import (
    BENCHMARK_TARGETS,
    compute_calibration_metrics,
)


class TestCalibration:
    def test_perfect_predictions(self):
        """Perfect predictions should have R²=1 and 100% coverage."""
        predictions = [
            {"central": 10_000_000, "p10": 8_000_000, "p90": 12_000_000},
            {"central": 20_000_000, "p10": 16_000_000, "p90": 24_000_000},
            {"central": 50_000_000, "p10": 40_000_000, "p90": 60_000_000},
        ]
        actuals = [10_000_000, 20_000_000, 50_000_000]

        result = compute_calibration_metrics(predictions, actuals)
        assert result.r_squared_log >= 0.99
        assert result.mean_abs_pct_error < 0.01
        assert result.interval_coverage == 1.0

    def test_empty_inputs(self):
        result = compute_calibration_metrics([], [])
        assert result.n_samples == 0

    def test_wide_bands_increase_coverage(self):
        predictions = [
            {"central": 10_000_000, "p10": 1_000_000, "p90": 100_000_000},
            {"central": 20_000_000, "p10": 2_000_000, "p90": 200_000_000},
        ]
        actuals = [15_000_000, 25_000_000]

        result = compute_calibration_metrics(predictions, actuals)
        assert result.interval_coverage == 1.0

    def test_benchmark_targets_defined(self):
        assert BENCHMARK_TARGETS["r_squared_log_min"] == 0.75
        assert BENCHMARK_TARGETS["mape_max"] == 0.35
        assert BENCHMARK_TARGETS["interval_coverage_target"] == 0.80
