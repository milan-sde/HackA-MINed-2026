"""
07 - Generate Predictions for Real-Time Data
SmartContainer Risk Engine – Phase 3, Step 7
"""
import pandas as pd
import numpy as np
import joblib
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import config

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
    flags = np.zeros(len(df))
    flags += (df['weight_diff_pct'] > 30).astype(int)
    flags += df['dwell_flag_120'].values
    v99 = df['value_per_kg'].quantile(0.99)
    flags += (df['value_per_kg'] > v99).astype(int)
    flags += (df['exporter_risk_score'] > 0.05).astype(int)
    return np.clip(flags, 0, 1)


rule_flags = get_rule_flags(realtime_df)
ensemble_scores = (0.6 * xgb_proba + 0.2 * iso_scores_norm + 0.2 * rule_flags) * 100


def get_risk_level(score, threshold):
    if score >= threshold:
        return 'Critical'
    elif score >= 30:
        return 'Low Risk'
    return 'Clear'


risk_levels    = [get_risk_level(s, best_threshold) for s in ensemble_scores]
anomaly_flags  = ((iso_forest.predict(X_rt_scaled) == -1) | (rule_flags == 1)).astype(int)


def generate_explanation(row, risk_level, score):
    parts = []
    if row['weight_diff_pct'] > 30:
        parts.append(f"Weight discrepancy of {row['weight_diff_pct']:.1f}%")
    elif row['weight_diff_pct'] > 15:
        parts.append(f"Moderate weight diff {row['weight_diff_pct']:.1f}%")
    if row['dwell_flag_120']:
        parts.append("Extended dwell time (>120hrs)")
    elif row['dwell_flag_80']:
        parts.append("High dwell time (>80hrs)")
    if row['is_high_risk_origin']:
        parts.append(f"High-risk origin ({row['Origin_Country']})")
    if row['exporter_risk_score'] > 0.1:
        parts.append("Exporter has high historical risk")
    if row['is_extreme_value']:
        parts.append("Extremely high declared value")
    if row['hs_chapter_risk'] > 0.05:
        parts.append(f"High-risk category (HS {row['hs_chapter']})")
    return ". ".join(parts[:2]) + "." if parts else "No significant anomalies detected."


explanations = [generate_explanation(row, risk_levels[i], ensemble_scores[i])
                for i, (_, row) in enumerate(realtime_df.iterrows())]

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

print("\n🔍 Top 10 Highest Risk Containers:")
print(output_df.sort_values('Risk_Score', ascending=False).head(10).to_string(index=False))
