"""
04 - Train XGBoost Classifier
SmartContainer Risk Engine – Phase 2, Step 4
"""
import pandas as pd
import numpy as np
import joblib
import matplotlib.pyplot as plt
import seaborn as sns
from xgboost import XGBClassifier
from sklearn.metrics import classification_report, confusion_matrix
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import config

print("=" * 60)
print("PHASE 2 - STEP 4: TRAINING XGBOOST")
print("=" * 60)

X_train, y_train, X_val, y_val, X_test, y_test = joblib.load(config.PREPARED_DATA)
feature_columns = joblib.load(config.FEATURE_COLUMNS)

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
print(classification_report(y_val, y_val_pred, target_names=['Clear', 'Critical', 'Low Risk']))

# Confusion matrix
cm = confusion_matrix(y_val, y_val_pred)
plt.figure(figsize=(8, 6))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
            xticklabels=['Clear', 'Critical', 'Low Risk'],
            yticklabels=['Clear', 'Critical', 'Low Risk'])
plt.title('Confusion Matrix - Validation Set')
plt.tight_layout()
plt.savefig(config.CONFUSION_MATRIX, dpi=150, bbox_inches='tight')
plt.show()

joblib.dump(model, config.XGBOOST_MODEL)
print(f"\n💾 Model saved to '{config.XGBOOST_MODEL}'")
