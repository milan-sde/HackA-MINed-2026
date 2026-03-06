"""
04 - Train XGBoost Classifier
SmartContainer Risk Engine – Phase 2, Step 4
"""
import pandas as pd
import numpy as np
import joblib
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from xgboost import XGBClassifier
from sklearn.metrics import (
    classification_report, confusion_matrix,
    f1_score, recall_score
)
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import config

print("=" * 60)
print("PHASE 2 - STEP 4: TRAINING XGBOOST")
print("=" * 60)

X_train, y_train, X_val, y_val, X_test, y_test = joblib.load(config.PREPARED_DATA)
feature_columns = joblib.load(config.FEATURE_COLUMNS)
label_encoder   = joblib.load(config.LABEL_ENCODER)
class_names     = list(label_encoder.classes_)

scale_pos_weight = 42347 / 545  # ~77.7
print(f"\n⚖️ scale_pos_weight = {scale_pos_weight:.1f}")

model = XGBClassifier(
    n_estimators=300,
    max_depth=6,
    learning_rate=0.05,
    scale_pos_weight=scale_pos_weight,
    eval_metric='mlogloss',
    random_state=42,
    n_jobs=-1,
    use_label_encoder=False
)

print("\n🚀 Training XGBoost model...")
model.fit(X_train, y_train)
print("✅ Training complete!")

# Evaluate
y_val_pred  = model.predict(X_val)
y_val_proba = model.predict_proba(X_val)

print("\n📊 Validation Set Performance:")
print(classification_report(y_val, y_val_pred, target_names=class_names))

# ── Evaluation Metrics ────────────────────────────────────
critical_idx = list(label_encoder.classes_).index('Critical')

macro_f1     = f1_score(y_val, y_val_pred, average='macro')
weighted_f1  = f1_score(y_val, y_val_pred, average='weighted')
critical_f1  = f1_score(y_val, y_val_pred, average=None)[critical_idx]
critical_rec = recall_score(y_val, y_val_pred, average=None)[critical_idx]

cm = confusion_matrix(y_val, y_val_pred)

print("\n📈 Key Metrics:")
print(f"   Macro F1 Score:           {macro_f1:.4f}")
print(f"   Weighted F1 Score:        {weighted_f1:.4f}")
print(f"   F1 Score (Critical):      {critical_f1:.4f}")
print(f"   Recall (Critical):        {critical_rec:.4f}")

# Save metrics to JSON
os.makedirs(config.OUTPUTS_DIR, exist_ok=True)
metrics = {
    "macro_f1_score":     round(float(macro_f1), 4),
    "weighted_f1_score":  round(float(weighted_f1), 4),
    "f1_critical":        round(float(critical_f1), 4),
    "recall_critical":    round(float(critical_rec), 4),
    "confusion_matrix":   cm.tolist(),
    "class_names":        class_names,
}
with open(config.MODEL_METRICS, "w") as f:
    json.dump(metrics, f, indent=2)
print(f"\n💾 Metrics saved to '{config.MODEL_METRICS}'")

# Confusion matrix plot
plt.figure(figsize=(8, 6))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
            xticklabels=class_names,
            yticklabels=class_names)
plt.title('Confusion Matrix - Validation Set')
plt.xlabel('Predicted')
plt.ylabel('Actual')
plt.tight_layout()
plt.savefig(config.CONFUSION_MATRIX, dpi=150, bbox_inches='tight')
plt.close()
print(f"💾 Confusion matrix plot saved to '{config.CONFUSION_MATRIX}'")

joblib.dump(model, config.XGBOOST_MODEL)
print(f"💾 Model saved to '{config.XGBOOST_MODEL}'")
