"""
07 - Generate Predictions for Real-Time Data
SmartContainer Risk Engine – Phase 3, Step 7

Hybrid anomaly detection:
  anomaly_score = 0.6 * xgboost_probability
                + 0.2 * isolation_forest_score
                + 0.2 * rule_based_score

Output fields: Container_ID, Risk_Score, Risk_Level, Anomaly_Flag, Explanation_Summary
"""
import pandas as pd
import numpy as np
import joblib
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

# Make the backend package importable so we can use the shared database layer
_BACKEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
sys.path.insert(0, _BACKEND_DIR)

import config
import database as db

print("=" * 60)
print("PHASE 3 - STEP 7: GENERATE PREDICTIONS")
print("=" * 60)

xgboost_model   = joblib.load(config.XGBOOST_MODEL)
iso_forest      = joblib.load(config.ISOLATION_FOREST)
scaler          = joblib.load(config.SCALER)
feature_columns = joblib.load(config.FEATURE_COLUMNS)
label_encoder   = joblib.load(config.LABEL_ENCODER)
best_threshold  = joblib.load(config.BEST_THRESHOLD)

realtime_df = pd.read_csv(config.REALTIME_ENGINEERED)
print(f"\n📊 Processing {len(realtime_df):,} real-time containers...")

X_rt = realtime_df[feature_columns].copy()
X_rt = X_rt.replace([np.inf, -np.inf], np.nan).fillna(X_rt.median())
X_rt_scaled = scaler.transform(X_rt)

# 1. XGBoost probabilities
xgb_proba = xgboost_model.predict_proba(X_rt_scaled)[:, 1]

# 2. Isolation Forest scores
iso_scores = iso_forest.score_samples(X_rt_scaled)
iso_scores_norm = 1 - (iso_scores - iso_scores.min()) / (iso_scores.max() - iso_scores.min())


def get_rule_flags(df):
    """Rule-based anomaly detection.

    Checks:
      - Large weight discrepancy  (|weight_diff_pct| > 0.30)
      - Extreme value_per_kg      (> 99th percentile)
      - Abnormal dwell_time       (dwell_flag_120)
      - High exporter_risk_score  (> 0.05)
    """
    flags = np.zeros(len(df))
    flags += (df['weight_diff_pct'].abs() > 0.30).astype(int)
    flags += df['dwell_flag_120'].values
    v99 = df['value_per_kg'].quantile(0.99)
    flags += (df['value_per_kg'] > v99).astype(int)
    flags += (df['exporter_risk_score'] > 0.05).astype(int)
    return np.clip(flags, 0, 1)


rule_flags = get_rule_flags(realtime_df)

# Hybrid anomaly score:
# anomaly_score = 0.6 * xgboost_probability + 0.2 * isolation_forest_score + 0.2 * rule_based_score
ensemble_scores = (0.6 * xgb_proba + 0.2 * iso_scores_norm + 0.2 * rule_flags) * 100


def get_risk_level(score, threshold):
    if score >= threshold:
        return 'Critical'
    elif score >= 30:
        return 'Low Risk'
    return 'Clear'


risk_levels    = [get_risk_level(s, best_threshold) for s in ensemble_scores]

# Anomaly_Flag: flagged by Isolation Forest OR rule-based checks
anomaly_flags  = ((iso_forest.predict(X_rt_scaled) == -1) | (rule_flags == 1)).astype(int)


def generate_explanation(row):
    """Generate a human-readable explanation for why a container was flagged.

    Checks engineered features and returns a concise summary of the
    risk drivers found for this container.
    """
    parts = []

    # Large weight discrepancy
    if abs(row['weight_diff_pct']) > 0.30:
        parts.append(f"Large weight discrepancy detected ({row['weight_diff_pct']:.1%})")
    elif abs(row['weight_diff_pct']) > 0.15:
        parts.append(f"Moderate weight discrepancy ({row['weight_diff_pct']:.1%})")

    # Unusual value-to-weight ratio
    if row.get('is_extreme_value', 0):
        parts.append("Unusual value-to-weight ratio")
    elif row['value_per_kg'] > row.get('_vpk_q95', row['value_per_kg'] + 1):
        parts.append("Elevated value-to-weight ratio")

    # Abnormal dwell time
    if row.get('dwell_flag_120', 0):
        parts.append(f"Abnormal dwell time ({row.get('dwell_time', 0):.0f}h)")
    elif row.get('dwell_flag_80', 0):
        parts.append(f"High dwell time ({row.get('dwell_time', 0):.0f}h)")

    # Exporter historically linked to high-risk shipments
    if row['exporter_risk_score'] > 0.1:
        parts.append("Exporter historically linked to high-risk shipments")
    elif row['exporter_risk_score'] > 0.05:
        parts.append("Exporter has moderate historical risk")

    # Importer risk
    if row['importer_risk_score'] > 0.1:
        parts.append("Importer historically linked to high-risk shipments")

    # Geographic risk
    if row.get('is_high_risk_origin', 0):
        parts.append(f"High-risk origin country ({row.get('Origin_Country', 'N/A')})")

    # HS code risk
    if row.get('hs_code_risk', 0) > 0.05:
        parts.append(f"High-risk HS code category (chapter {row.get('hs_chapter', 'N/A')})")

    return ". ".join(parts[:3]) + "." if parts else "No significant anomalies detected."


explanations = [generate_explanation(row) for _, row in realtime_df.iterrows()]

# ── Core predictions output ───────────────────────────────
output_df = pd.DataFrame({
    'Container_ID':       realtime_df['Container_ID'],
    'Risk_Score':         np.round(ensemble_scores, 1),
    'Risk_Level':         risk_levels,
    'Anomaly_Flag':       anomaly_flags,
    'Explanation_Summary': explanations
})

print("\n📊 Prediction Distribution:")
dist = output_df['Risk_Level'].value_counts()
pct  = output_df['Risk_Level'].value_counts(normalize=True) * 100
for level in ['Critical', 'Low Risk', 'Clear']:
    print(f"  {level:10s}: {dist.get(level, 0):5,d} ({pct.get(level, 0):.1f}%)")

output_df.to_csv(config.PREDICTIONS, index=False)
print(f"\n💾 Predictions saved to '{config.PREDICTIONS}'")

# ── Full predictions with engineered features (for dashboard) ─
engineered_features = [
    'weight_diff_pct', 'value_per_kg', 'dwell_time',
    'exporter_risk_score', 'importer_risk_score', 'hs_code_risk',
]
raw_columns = [
    'Declaration_Date (YYYY-MM-DD)', 'Declaration_Time',
    'Trade_Regime (Import / Export / Transit)',
    'Origin_Country', 'Destination_Port', 'Destination_Country',
    'HS_Code', 'Importer_ID', 'Exporter_ID',
    'Declared_Value', 'Declared_Weight', 'Measured_Weight',
    'Dwell_Time_Hours',
]

extra_cols = [c for c in raw_columns + engineered_features if c in realtime_df.columns]
full_df = pd.concat([output_df, realtime_df[extra_cols].reset_index(drop=True)], axis=1)
full_df.to_csv(config.FULL_PREDICTIONS, index=False)
print(f"💾 Full predictions (with features) saved to '{config.FULL_PREDICTIONS}'")

# ---------------------------------------------------------------------------
# Persist predictions to SQLite database
# ---------------------------------------------------------------------------
db.init_db()
db_rows = [
    {
        "container_id": str(row["Container_ID"]),
        "risk_score":   float(row["Risk_Score"]),
        "risk_level":   str(row["Risk_Level"]),
        "anomaly_flag": int(row["Anomaly_Flag"]),
        "explanation":  str(row["Explanation_Summary"]),
    }
    for _, row in output_df.iterrows()
]
n_inserted = db.bulk_upsert_containers(db_rows)
print(f"💾 {n_inserted} predictions upserted into database.db")

print("\n🔍 Top 10 Highest Risk Containers:")
print(output_df.sort_values('Risk_Score', ascending=False).head(10).to_string(index=False))
