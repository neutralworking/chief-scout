"""
Benchmarking and calibration utilities.

Compares valuation outputs against known transfer fees, Transfermarkt
values, and other reference points. Used for model validation and
interval calibration.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass
class CalibrationResult:
    """Results from a calibration run."""
    n_samples: int
    r_squared_log: float            # R² on log-transformed fees
    mean_abs_pct_error: float       # MAPE
    median_abs_pct_error: float     # MdAPE
    p10_coverage: float             # % of actuals below P10
    p90_coverage: float             # % of actuals above P90
    interval_coverage: float        # % of actuals within P10-P90
    mean_band_width: float          # average P90/P10 ratio


def compute_calibration_metrics(
    predictions: list[dict],
    actuals: list[float],
) -> CalibrationResult:
    """
    Compute calibration metrics against actual transfer fees.

    predictions: list of dicts with keys: central, p10, p90
    actuals: list of actual transfer fees in EUR
    """
    n = len(predictions)
    if n == 0 or n != len(actuals):
        return CalibrationResult(
            n_samples=0, r_squared_log=0, mean_abs_pct_error=0,
            median_abs_pct_error=0, p10_coverage=0, p90_coverage=0,
            interval_coverage=0, mean_band_width=0,
        )

    # R² on log-transformed values
    log_preds = [math.log1p(p["central"]) for p in predictions]
    log_actuals = [math.log1p(a) for a in actuals]

    mean_actual = sum(log_actuals) / n
    ss_res = sum((la - lp) ** 2 for la, lp in zip(log_actuals, log_preds))
    ss_tot = sum((la - mean_actual) ** 2 for la in log_actuals)
    r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0

    # MAPE and MdAPE
    abs_pct_errors = []
    for pred, actual in zip(predictions, actuals):
        if actual > 0:
            abs_pct_errors.append(abs(pred["central"] - actual) / actual)

    mape = sum(abs_pct_errors) / len(abs_pct_errors) if abs_pct_errors else 0
    sorted_ape = sorted(abs_pct_errors)
    mdape = sorted_ape[len(sorted_ape) // 2] if sorted_ape else 0

    # Interval coverage
    below_p10 = sum(1 for p, a in zip(predictions, actuals) if a < p["p10"]) / n
    above_p90 = sum(1 for p, a in zip(predictions, actuals) if a > p["p90"]) / n
    in_interval = sum(
        1 for p, a in zip(predictions, actuals)
        if p["p10"] <= a <= p["p90"]
    ) / n

    # Band width
    band_widths = [
        p["p90"] / max(p["p10"], 1) for p in predictions
    ]
    mean_bw = sum(band_widths) / len(band_widths) if band_widths else 0

    return CalibrationResult(
        n_samples=n,
        r_squared_log=round(r_squared, 4),
        mean_abs_pct_error=round(mape, 4),
        median_abs_pct_error=round(mdape, 4),
        p10_coverage=round(below_p10, 4),
        p90_coverage=round(above_p90, 4),
        interval_coverage=round(in_interval, 4),
        mean_band_width=round(mean_bw, 2),
    )


# Benchmark targets from spec
BENCHMARK_TARGETS = {
    "r_squared_log_min": 0.75,
    "mape_max": 0.35,
    "interval_coverage_target": 0.80,
}
