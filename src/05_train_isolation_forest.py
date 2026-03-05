"""
05 - Train Isolation Forest (Anomaly Detection)
SmartContainer Risk Engine – Phase 2, Step 5
"""
import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import IsolationForest
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import config

print("=" * 60)
print("PHASE 2 - STEP 5: TRAINING ISOLATION FOREST")
print("=" * 60)

X_train, y_train, X_val, y_val, X_test, y_test = joblib.load(config.PREPARED_DATA)
feature_columns = joblib.load(config.FEATURE_COLUMNS)

iso_forest = IsolationForest(
    contamination=0.01,
    random_state=42,
    n_estimators=100,
    max_samples='auto',
    bootstrap=False,
    n_jobs=-1
)

print("🚀 Training Isolation Forest...")
iso_forest.fit(X_train)

# Evaluate
val_anomaly_pred  = iso_forest.predict(X_val)
val_anomaly_score = (val_anomaly_pred == -1).astype(int)

print(f"\n📊 Anomaly Detection Results:")
print(f"   Validation - Anomalies: {sum(val_anomaly_score)} ({sum(val_anomaly_score)/len(val_anomaly_score)*100:.2f}%)")

critical_indices = y_val == 1
overlap = sum((critical_indices.values if hasattr(critical_indices, 'values') else critical_indices) & (val_anomaly_score == 1))
critical_count = sum(critical_indices)
print(f"\n🎯 Overlap with actual Critical class:")
print(f"   Critical containers: {critical_count}")
print(f"   Overlap: {overlap} ({overlap/critical_count*100:.1f}% of Critical detected)")

# Normalized anomaly scores
val_scores = iso_forest.score_samples(X_val)
val_scores_norm = 1 - (val_scores - val_scores.min()) / (val_scores.max() - val_scores.min())

joblib.dump(iso_forest, config.ISOLATION_FOREST)
joblib.dump(val_scores_norm, config.VAL_ANOMALY_SCORES)
print(f"\n💾 Isolation Forest saved to '{config.ISOLATION_FOREST}'")
