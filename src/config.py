"""
SmartContainer Risk Engine - Path Configuration
All file paths relative to the project root.
"""
import os

# Project root (one level up from src/)
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── Data directories ──────────────────────────────────────
RAW_DATA_DIR       = os.path.join(ROOT_DIR, "data", "raw")
PROCESSED_DATA_DIR = os.path.join(ROOT_DIR, "data", "processed")
MODELS_DIR         = os.path.join(ROOT_DIR, "models")
OUTPUTS_DIR        = os.path.join(ROOT_DIR, "outputs")

# ── Raw data files ────────────────────────────────────────
HISTORICAL_RAW = os.path.join(RAW_DATA_DIR, "Historical_Data.csv")
REALTIME_RAW   = os.path.join(RAW_DATA_DIR, "Real_Time_Data.csv")

# ── Processed data files ──────────────────────────────────
HISTORICAL_ENGINEERED = os.path.join(PROCESSED_DATA_DIR, "Historical_Engineered.csv")
REALTIME_ENGINEERED   = os.path.join(PROCESSED_DATA_DIR, "Realtime_Engineered.csv")
PREDICTIONS           = os.path.join(PROCESSED_DATA_DIR, "predictions.csv")
THRESHOLD_ANALYSIS    = os.path.join(PROCESSED_DATA_DIR, "threshold_analysis.csv")

# ── Model artifacts ───────────────────────────────────────
RISK_MAPPINGS    = os.path.join(MODELS_DIR, "risk_mappings.pkl")
LABEL_ENCODER    = os.path.join(MODELS_DIR, "label_encoder.pkl")
SCALER           = os.path.join(MODELS_DIR, "scaler.pkl")
PREPARED_DATA    = os.path.join(MODELS_DIR, "prepared_data.pkl")
FEATURE_COLUMNS  = os.path.join(MODELS_DIR, "feature_columns.pkl")
XGBOOST_MODEL    = os.path.join(MODELS_DIR, "xgboost_model.pkl")
ISOLATION_FOREST = os.path.join(MODELS_DIR, "isolation_forest.pkl")
VAL_ANOMALY_SCORES = os.path.join(MODELS_DIR, "val_anomaly_scores.pkl")
BEST_THRESHOLD   = os.path.join(MODELS_DIR, "best_threshold.pkl")
ENSEMBLE_INFO    = os.path.join(MODELS_DIR, "ensemble_info.pkl")

# ── Output files ──────────────────────────────────────────
CONFUSION_MATRIX       = os.path.join(OUTPUTS_DIR, "confusion_matrix.png")
THRESHOLD_OPTIMIZATION = os.path.join(OUTPUTS_DIR, "threshold_optimization.png")
MODEL_METRICS          = os.path.join(OUTPUTS_DIR, "model_metrics.json")
FULL_PREDICTIONS       = os.path.join(PROCESSED_DATA_DIR, "full_predictions.csv")
