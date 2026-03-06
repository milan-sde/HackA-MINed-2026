"""
Model Loader — SmartContainer Risk Engine

Loads all ML artifacts once at startup and exposes them as a frozen ModelBundle.
Also derives two inference-time calibration constants that the training pipeline
computes on-the-fly from a batch but that must be fixed for single-record serving:

  • value_99th         – 99th-percentile of Declared_Value (training set)
                         used to compute the `is_extreme_value` feature.
  • value_per_kg_99th  – 99th-percentile of value_per_kg (training set)
                         used inside the rule-flag computation.
  • iso_score_min/max  – raw score_samples bounds on the validation set,
                         used to reproduce the [0, 1] normalisation of the
                         Isolation Forest score before ensembling.
"""

import os
import logging

import joblib
import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Resolve paths relative to the project root (one level above backend/)
# ---------------------------------------------------------------------------
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_ROOT_DIR    = os.path.dirname(_BACKEND_DIR)
MODELS_DIR   = os.path.join(_ROOT_DIR, "models")
RAW_DATA_DIR = os.path.join(_ROOT_DIR, "data", "raw")


# ---------------------------------------------------------------------------
# Data container
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class ModelBundle:
    xgboost_model:     Any
    iso_forest:        Any
    scaler:            Any
    label_encoder:     Any
    feature_columns:   list
    best_threshold:    float
    risk_mappings:     dict
    value_99th:        float   # Declared_Value threshold for is_extreme_value
    value_per_kg_99th: float   # value_per_kg threshold for rule flags
    iso_score_min:     float   # Isolation Forest raw score lower bound
    iso_score_max:     float   # Isolation Forest raw score upper bound


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _load(filename: str, label: str) -> Any:
    path = os.path.join(MODELS_DIR, filename)
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Required model artifact '{label}' not found at: {path}"
        )
    artifact = joblib.load(path)
    logger.info("  Loaded %-30s from %s", label, path)
    return artifact


def _derive_iso_bounds(iso_forest, models_dir: str) -> tuple[float, float]:
    """
    Compute the min/max of iso_forest.score_samples on the validation set so
    we can reproduce the 0-1 normalisation used during training.
    Falls back to empirical defaults when prepared_data.pkl is absent.
    """
    prepared_path = os.path.join(models_dir, "prepared_data.pkl")
    if os.path.exists(prepared_path):
        _, _, X_val, _, _, _ = joblib.load(prepared_path)
        raw = iso_forest.score_samples(X_val)
        lo, hi = float(raw.min()), float(raw.max())
        logger.info("  Iso score bounds (from val set): min=%.4f, max=%.4f", lo, hi)
        return lo, hi
    logger.warning(
        "  prepared_data.pkl not found — using fallback iso bounds [-0.50, 0.00]"
    )
    return -0.50, 0.00


def _derive_value_thresholds(raw_data_dir: str) -> tuple[float, float]:
    """
    Compute the training-set 99th-percentile of Declared_Value and value_per_kg.
    Falls back to conservative defaults when the CSV is absent (e.g. in Docker).
    """
    hist_path = os.path.join(raw_data_dir, "Historical_Data.csv")
    if os.path.exists(hist_path):
        df = pd.read_csv(hist_path, usecols=["Declared_Value", "Declared_Weight"])
        v99       = float(df["Declared_Value"].quantile(0.99))
        vpk       = df["Declared_Value"] / (df["Declared_Weight"] + 0.001)
        vpk_99    = float(vpk.quantile(0.99))
        logger.info(
            "  value_99th=%.2f, value_per_kg_99th=%.4f (from training data)",
            v99, vpk_99,
        )
        return v99, vpk_99
    logger.warning(
        "  Historical_Data.csv not found — using fallback thresholds (100000, 500)"
    )
    return 100_000.0, 500.0


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def load_models() -> ModelBundle:
    logger.info("=" * 55)
    logger.info("Loading SmartContainer Risk Engine model artifacts …")
    logger.info("=" * 55)

    xgboost_model   = _load("xgboost_model.pkl",    "XGBoost classifier")
    iso_forest      = _load("isolation_forest.pkl",  "Isolation Forest")
    scaler          = _load("scaler.pkl",            "StandardScaler")
    label_encoder   = _load("label_encoder.pkl",     "LabelEncoder")
    feature_columns = _load("feature_columns.pkl",   "Feature column list")
    best_threshold  = float(_load("best_threshold.pkl", "Best threshold"))
    risk_mappings   = _load("risk_mappings.pkl",     "Risk mappings")

    iso_score_min, iso_score_max = _derive_iso_bounds(iso_forest, MODELS_DIR)
    value_99th, value_per_kg_99th = _derive_value_thresholds(RAW_DATA_DIR)

    logger.info("All artifacts loaded. Best threshold = %.1f", best_threshold)
    logger.info("=" * 55)

    return ModelBundle(
        xgboost_model     = xgboost_model,
        iso_forest        = iso_forest,
        scaler            = scaler,
        label_encoder     = label_encoder,
        feature_columns   = list(feature_columns),
        best_threshold    = best_threshold,
        risk_mappings     = risk_mappings,
        value_99th        = value_99th,
        value_per_kg_99th = value_per_kg_99th,
        iso_score_min     = iso_score_min,
        iso_score_max     = iso_score_max,
    )
