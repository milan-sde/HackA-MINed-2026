"""
Prediction Service — SmartContainer Risk Engine

Single-record and batch inference pipelines:

  • predict()       — one container  (POST /predict)
  • predict_batch() — DataFrame-level vectorised  (POST /predict-batch)

Pipeline steps (same for both paths):
  1. Feature engineering
  2. StandardScaler transform
  3. XGBoost   → P(Critical)
  4. Isolation Forest → normalised anomaly score
  5. Rule flags (heuristic checks)
  6. Ensemble score  = 0.6·XGB + 0.2·ISO + 0.2·RULES  (×100)
  7. Risk level classification against best_threshold
  8. Anomaly flag
  9. Natural-language explanation

Mirrors src/07_generate_predictions.py (the production inference step).
"""

import logging
from datetime import datetime
from dataclasses import dataclass

import numpy as np
import pandas as pd

from feature_engineering import (
    engineer_features,
    engineer_features_batch,
    RawContext,
)
from model_loader import ModelBundle

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# I/O schemas (plain dataclasses — Pydantic models live in main.py)
# ---------------------------------------------------------------------------
@dataclass
class ContainerInput:
    container_id:      int | str
    declared_value:    float
    declared_weight:   float
    measured_weight:   float
    origin_country:    str
    destination_country: str
    hs_code:           str
    importer_id:       str
    exporter_id:       str
    dwell_time_hours:  float = 0.0
    declaration_dt:    datetime | None = None


@dataclass
class PredictionResult:
    container_id:        int | str
    risk_score:          float
    risk_level:          str
    anomaly_flag:        int
    explanation_summary: str
    details: dict


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
def _normalise_iso_score(
    raw_score: float,
    iso_min: float,
    iso_max: float,
) -> float:
    """
    Reproduces:
        iso_scores_norm = 1 - (iso_scores - min) / (max - min)

    When max == min (degenerate single-record edge case) the score is
    clamped to the midpoint (0.5) rather than producing NaN.
    """
    span = iso_max - iso_min
    if span < 1e-9:
        return 0.5
    norm = 1.0 - (raw_score - iso_min) / span
    return float(np.clip(norm, 0.0, 1.0))


def _get_rule_flag(ctx: RawContext, value_per_kg_99th: float) -> int:
    """
    Heuristic rule flags from src/07_generate_predictions.py.
    Each condition contributes 1; total is clipped to [0, 1].
    """
    flags = 0
    flags += int(ctx.weight_diff_pct > 30)
    flags += ctx.dwell_flag_120
    flags += int(ctx.value_per_kg > value_per_kg_99th)
    flags += int(ctx.exporter_risk_score > 0.05)
    return int(np.clip(flags, 0, 1))


def _get_risk_level(score: float, threshold: float) -> str:
    if score >= threshold:
        return "Critical"
    if score >= 30:
        return "Low Risk"
    return "Clear"


def _generate_explanation(ctx: RawContext, risk_level: str, score: float) -> str:
    """
    Builds a human-readable explanation (max two most prominent signals).
    Mirrors src/07_generate_predictions.py generate_explanation().
    """
    parts: list[str] = []

    if ctx.weight_diff_pct > 30:
        parts.append(f"Weight discrepancy of {ctx.weight_diff_pct:.1f}%")
    elif ctx.weight_diff_pct > 15:
        parts.append(f"Moderate weight difference of {ctx.weight_diff_pct:.1f}%")

    if ctx.dwell_flag_120:
        parts.append("Extended dwell time (>120 hrs)")
    elif ctx.dwell_flag_80:
        parts.append("High dwell time (>80 hrs)")

    if ctx.is_high_risk_origin:
        parts.append(f"High-risk origin country ({ctx.origin_country.upper()})")

    if ctx.exporter_risk_score > 0.1:
        parts.append("Exporter has high historical risk")

    if ctx.is_extreme_value:
        parts.append("Extremely high declared value")

    if ctx.hs_chapter_risk > 0.05:
        parts.append(f"High-risk HS chapter ({ctx.hs_chapter:02d})")

    if not parts:
        return "No significant anomalies detected."

    # Mirror original: join first two signals with ". ", append trailing "."
    return ". ".join(parts[:2]) + "."


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def predict(inp: ContainerInput, bundle: ModelBundle) -> PredictionResult:
    """
    Run the full SmartContainer Risk Engine pipeline for one container.

    Parameters
    ----------
    inp    : ContainerInput — raw shipment data from the API request.
    bundle : ModelBundle   — pre-loaded model artifacts from model_loader.

    Returns
    -------
    PredictionResult with Risk_Score, Risk_Level, Anomaly_Flag,
    Explanation_Summary, and a diagnostics details dict.
    """

    # ── 1. Feature engineering ────────────────────────────────────────────
    features, ctx = engineer_features(
        declared_value   = inp.declared_value,
        declared_weight  = inp.declared_weight,
        measured_weight  = inp.measured_weight,
        origin_country   = inp.origin_country,
        hs_code          = inp.hs_code,
        importer_id      = inp.importer_id,
        exporter_id      = inp.exporter_id,
        risk_mappings    = bundle.risk_mappings,
        value_99th       = bundle.value_99th,
        dwell_time_hours = inp.dwell_time_hours,
        declaration_dt   = inp.declaration_dt,
    )

    # ── 2. Build feature vector in training order ─────────────────────────
    raw_vec = features.as_ordered_list(bundle.feature_columns)

    # Guard against NaN / Inf that could come from edge-case inputs
    raw_vec = [0.0 if (v != v or v in (float("inf"), float("-inf"))) else v
               for v in raw_vec]

    X = np.array(raw_vec, dtype=float).reshape(1, -1)

    # ── 3. Scale ──────────────────────────────────────────────────────────
    X_scaled = bundle.scaler.transform(X)

    # ── 4. XGBoost probability of Critical class (class index 1) ─────────
    xgb_proba = float(bundle.xgboost_model.predict_proba(X_scaled)[0, 1])

    # ── 5. Isolation Forest — normalised anomaly score ────────────────────
    iso_raw  = float(bundle.iso_forest.score_samples(X_scaled)[0])
    iso_norm = _normalise_iso_score(
        iso_raw, bundle.iso_score_min, bundle.iso_score_max
    )

    # ── 6. Rule flags ─────────────────────────────────────────────────────
    rule_flag = _get_rule_flag(ctx, bundle.value_per_kg_99th)

    # ── 7. Ensemble score ─────────────────────────────────────────────────
    ensemble_score = round(
        (0.6 * xgb_proba + 0.2 * iso_norm + 0.2 * rule_flag) * 100, 2
    )

    # ── 8. Risk level ─────────────────────────────────────────────────────
    risk_level = _get_risk_level(ensemble_score, bundle.best_threshold)

    # ── 9. Anomaly flag ───────────────────────────────────────────────────
    iso_pred    = int(bundle.iso_forest.predict(X_scaled)[0])   # 1 = normal, -1 = anomaly
    anomaly_flag = int(iso_pred == -1 or rule_flag == 1)

    # ── 10. Explanation ───────────────────────────────────────────────────
    explanation = _generate_explanation(ctx, risk_level, ensemble_score)

    logger.debug(
        "Container %s | XGB=%.4f ISO=%.4f RULE=%d SCORE=%.2f LEVEL=%s",
        inp.container_id, xgb_proba, iso_norm, rule_flag, ensemble_score, risk_level,
    )

    return PredictionResult(
        container_id        = inp.container_id,
        risk_score          = ensemble_score,
        risk_level          = risk_level,
        anomaly_flag        = anomaly_flag,
        explanation_summary = explanation,
        details = {
            "xgb_probability":      round(xgb_proba, 4),
            "iso_score_normalised": round(iso_norm, 4),
            "rule_flag":            rule_flag,
            "threshold_used":       bundle.best_threshold,
        },
    )


# ═══════════════════════════════════════════════════════════════════════════
# Batch prediction  (vectorised — optimised for up to 10k+ rows)
# ═══════════════════════════════════════════════════════════════════════════
@dataclass
class BatchPredictionItem:
    container_id:        int | str
    risk_score:          float
    risk_level:          str
    anomaly_flag:        int
    explanation_summary: str


@dataclass
class BatchResult:
    predictions:    list[BatchPredictionItem]
    total:          int
    critical_count: int
    low_risk_count: int
    clear_count:    int


def _vectorised_rule_flags(df: pd.DataFrame, value_per_kg_99th: float) -> np.ndarray:
    """Mirrors get_rule_flags() from src/07_generate_predictions.py."""
    flags = np.zeros(len(df))
    flags += (df["weight_diff_pct"] > 30).astype(int).values
    flags += df["dwell_flag_120"].values
    flags += (df["value_per_kg"] > value_per_kg_99th).astype(int).values
    flags += (df["exporter_risk_score"] > 0.05).astype(int).values
    return np.clip(flags, 0, 1)


def _vectorised_explanations(df: pd.DataFrame) -> list[str]:
    """Generate explanations for every row. Iterates but is string-only work."""
    explanations: list[str] = []
    for _, row in df.iterrows():
        parts: list[str] = []

        if row["weight_diff_pct"] > 30:
            parts.append(f"Weight discrepancy of {row['weight_diff_pct']:.1f}%")
        elif row["weight_diff_pct"] > 15:
            parts.append(f"Moderate weight difference of {row['weight_diff_pct']:.1f}%")

        if row["dwell_flag_120"]:
            parts.append("Extended dwell time (>120 hrs)")
        elif row["dwell_flag_80"]:
            parts.append("High dwell time (>80 hrs)")

        if row["is_high_risk_origin"]:
            parts.append(f"High-risk origin country ({row['Origin_Country'].upper()})")

        if row["exporter_risk_score"] > 0.1:
            parts.append("Exporter has high historical risk")

        if row["is_extreme_value"]:
            parts.append("Extremely high declared value")

        if row["hs_chapter_risk"] > 0.05:
            parts.append(f"High-risk HS chapter ({int(row['hs_chapter']):02d})")

        explanations.append(
            ". ".join(parts[:2]) + "." if parts else "No significant anomalies detected."
        )
    return explanations


def predict_batch(df: pd.DataFrame, bundle: ModelBundle) -> BatchResult:
    """
    Vectorised batch prediction for an entire DataFrame.

    All heavy computation (scaling, XGBoost, Isolation Forest) is done as
    single matrix operations so 10k rows complete in seconds, not minutes.
    """
    n = len(df)
    logger.info("Batch prediction started — %d containers", n)

    # ── 1. Feature engineering (vectorised) ───────────────────────────────
    eng_df = engineer_features_batch(
        df,
        risk_mappings=bundle.risk_mappings,
        value_99th=bundle.value_99th,
    )

    # ── 2. Build feature matrix in training column order ──────────────────
    X = eng_df[bundle.feature_columns].copy()
    X = X.replace([np.inf, -np.inf], np.nan)
    col_medians = X.median()
    X = X.fillna(col_medians)
    X_arr = X.values.astype(float)

    # ── 3. Scale ──────────────────────────────────────────────────────────
    X_scaled = bundle.scaler.transform(X_arr)

    # ── 4. XGBoost P(Critical) ────────────────────────────────────────────
    xgb_proba = bundle.xgboost_model.predict_proba(X_scaled)[:, 1]

    # ── 5. Isolation Forest — normalised anomaly score ────────────────────
    iso_raw = bundle.iso_forest.score_samples(X_scaled)
    span = bundle.iso_score_max - bundle.iso_score_min
    if span < 1e-9:
        iso_norm = np.full(n, 0.5)
    else:
        iso_norm = 1.0 - (iso_raw - bundle.iso_score_min) / span
        iso_norm = np.clip(iso_norm, 0.0, 1.0)

    # ── 6. Rule flags ─────────────────────────────────────────────────────
    rule_flags = _vectorised_rule_flags(eng_df, bundle.value_per_kg_99th)

    # ── 7. Ensemble score ─────────────────────────────────────────────────
    ensemble_scores = np.round(
        (0.6 * xgb_proba + 0.2 * iso_norm + 0.2 * rule_flags) * 100, 2
    )

    # ── 8. Risk levels ────────────────────────────────────────────────────
    risk_levels = np.where(
        ensemble_scores >= bundle.best_threshold, "Critical",
        np.where(ensemble_scores >= 30, "Low Risk", "Clear"),
    )

    # ── 9. Anomaly flags ──────────────────────────────────────────────────
    iso_pred = bundle.iso_forest.predict(X_scaled)          # 1 = normal, -1 = anomaly
    anomaly_flags = ((iso_pred == -1) | (rule_flags == 1)).astype(int)

    # ── 10. Explanations ──────────────────────────────────────────────────
    explanations = _vectorised_explanations(eng_df)

    # ── Build output ──────────────────────────────────────────────────────
    container_ids = eng_df["Container_ID"].tolist()

    predictions = [
        BatchPredictionItem(
            container_id        = container_ids[i],
            risk_score          = float(ensemble_scores[i]),
            risk_level          = str(risk_levels[i]),
            anomaly_flag        = int(anomaly_flags[i]),
            explanation_summary = explanations[i],
        )
        for i in range(n)
    ]

    level_counts = pd.Series(risk_levels).value_counts()

    result = BatchResult(
        predictions    = predictions,
        total          = n,
        critical_count = int(level_counts.get("Critical", 0)),
        low_risk_count = int(level_counts.get("Low Risk", 0)),
        clear_count    = int(level_counts.get("Clear", 0)),
    )

    logger.info(
        "Batch complete — %d total | %d Critical | %d Low Risk | %d Clear",
        result.total, result.critical_count, result.low_risk_count, result.clear_count,
    )
    return result
