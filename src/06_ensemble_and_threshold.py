"""
06 - Ensemble & Threshold Tuning
SmartContainer Risk Engine – Phase 2, Step 6
"""
import pandas as pd
import numpy as np
import joblib
import matplotlib.pyplot as plt
from sklearn.metrics import f1_score, recall_score, precision_score
import warnings
warnings.filterwarnings('ignore')
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import config

print("=" * 60)
print("PHASE 2 - STEP 6: ENSEMBLE & THRESHOLD TUNING")
print("=" * 60)

X_train, y_train, X_val, y_val, X_test, y_test = joblib.load(config.PREPARED_DATA)
xgboost_model   = joblib.load(config.XGBOOST_MODEL)
iso_forest      = joblib.load(config.ISOLATION_FOREST)
feature_columns = joblib.load(config.FEATURE_COLUMNS)
print("✅ Loaded all models and data")

X_val_df = pd.DataFrame(X_val, columns=feature_columns) if isinstance(X_val, np.ndarray) else X_val.copy()

# XGBoost probabilities for Critical class
xgb_val_proba = xgboost_model.predict_proba(X_val)[:, 1]

# Isolation Forest scores (normalized)
iso_val_scores = iso_forest.score_samples(X_val)
iso_val_scores_norm = 1 - (iso_val_scores - iso_val_scores.min()) / (iso_val_scores.max() - iso_val_scores.min())


def get_rule_flags(X_df):
    flags = np.zeros(len(X_df))
    if 'weight_diff_pct'      in X_df.columns: flags += (X_df['weight_diff_pct'] > 30).astype(int)
    if 'dwell_flag_120'       in X_df.columns: flags += X_df['dwell_flag_120'].values
    if 'is_high_risk_origin'  in X_df.columns: flags += X_df['is_high_risk_origin'].values
    if 'value_per_kg'         in X_df.columns:
        v99 = X_df['value_per_kg'].quantile(0.99)
        flags += (X_df['value_per_kg'] > v99).astype(int)
    if 'exporter_risk_score'  in X_df.columns: flags += (X_df['exporter_risk_score'] > 0.05).astype(int)
    return np.clip(flags, 0, 1)


rule_flags = get_rule_flags(X_val_df)
ensemble_scores = (0.6 * xgb_val_proba + 0.2 * iso_val_scores_norm + 0.2 * rule_flags) * 100

actual_critical = (y_val == 1).astype(int)
critical_count  = sum(actual_critical)

# Threshold search
print(f"\n🔍 Threshold sweep (actual Critical: {critical_count})")
print("-" * 60)
print(f"{'Threshold':>10} {'F1':>8} {'Recall':>8} {'Precision':>10} {'#Predicted':>12}")
print("-" * 60)

thresholds, f1_scores, recalls, precisions, pred_counts = [], [], [], [], []
best_f1, best_threshold = 0, 70

for t in np.arange(20, 90, 5):
    pred = (ensemble_scores >= t).astype(int)
    f1   = f1_score(actual_critical, pred, zero_division=0)
    rec  = recall_score(actual_critical, pred, zero_division=0)
    prec = precision_score(actual_critical, pred, zero_division=0)
    cnt  = sum(pred)
    thresholds.append(t); f1_scores.append(f1); recalls.append(rec)
    precisions.append(prec); pred_counts.append(cnt)
    print(f"{t:10.0f} {f1:8.3f} {rec:8.3f} {prec:10.3f} {cnt:12d}")
    if f1 > best_f1:
        best_f1 = f1; best_threshold = t

print("-" * 60)
print(f"\n✅ Best threshold: {best_threshold}  (F1={best_f1:.3f})")

# Plot
fig, axes = plt.subplots(1, 2, figsize=(12, 5))
axes[0].plot(thresholds, f1_scores, 'b-', label='F1', linewidth=2)
axes[0].plot(thresholds, recalls,   'g-', label='Recall', linewidth=2)
axes[0].plot(thresholds, precisions,'r-', label='Precision', linewidth=2)
axes[0].axvline(x=best_threshold, color='k', linestyle='--', label=f'Best ({best_threshold})')
axes[0].set(xlabel='Threshold', ylabel='Score', title='Threshold Optimization')
axes[0].legend(); axes[0].grid(alpha=0.3)

axes[1].plot(thresholds, pred_counts, 'purple', marker='o', linewidth=2)
axes[1].axhline(y=critical_count, color='red', linestyle='--', label=f'Actual ({critical_count})')
axes[1].set(xlabel='Threshold', ylabel='# Containers', title='Critical Predictions vs Threshold')
axes[1].legend(); axes[1].grid(alpha=0.3)

plt.tight_layout()
plt.savefig(config.THRESHOLD_OPTIMIZATION, dpi=150, bbox_inches='tight')
plt.show()

# Final performance
final_pred      = (ensemble_scores >= best_threshold).astype(int)
final_f1        = f1_score(actual_critical, final_pred, zero_division=0)
final_recall    = recall_score(actual_critical, final_pred, zero_division=0)
final_precision = precision_score(actual_critical, final_pred, zero_division=0)

print("\n📊 Final Ensemble Performance:")
print(f"   Threshold: {best_threshold} | F1: {final_f1:.3f} | Recall: {final_recall:.3f} | Precision: {final_precision:.3f}")
print(f"   Detected {sum(final_pred)} of {critical_count} Critical containers")

# Save
joblib.dump(best_threshold, config.BEST_THRESHOLD)
joblib.dump({'threshold': best_threshold, 'f1_score': final_f1, 'recall': final_recall,
             'precision': final_precision, 'ensemble_scores': ensemble_scores,
             'xgb_weights': 0.6, 'iso_weights': 0.2, 'rule_weights': 0.2}, config.ENSEMBLE_INFO)

summary_df = pd.DataFrame({'threshold': thresholds, 'f1_score': f1_scores,
                            'recall': recalls, 'precision': precisions,
                            'critical_predictions': pred_counts})
summary_df.to_csv(config.THRESHOLD_ANALYSIS, index=False)
print(f"\n💾 Saved threshold analysis, best threshold ({best_threshold}), and ensemble info.")
print("\n✅ Step 6 complete!")
