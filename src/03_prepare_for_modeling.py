"""
03 - Prepare Data for Modeling
SmartContainer Risk Engine – Phase 1, Step 3
"""
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.utils.class_weight import compute_class_weight
import joblib
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import config

print("=" * 60)
print("PHASE 1 - STEP 3: PREPARE FOR MODELING")
print("=" * 60)

try:
    historical_df = pd.read_csv(config.HISTORICAL_ENGINEERED)
    realtime_df   = pd.read_csv(config.REALTIME_ENGINEERED)
    print(f"✅ Loaded {len(historical_df):,} historical rows and {len(realtime_df):,} real-time rows")
except FileNotFoundError as e:
    print(f"❌ Error: {e}")
    raise SystemExit(1)

# Encode target variable
print("\n🎯 Encoding target variable...")
le = LabelEncoder()
historical_df['risk_level_encoded'] = le.fit_transform(historical_df['Clearance_Status'])
print(f"   Mapping: {dict(zip(le.classes_, le.transform(le.classes_)))}")
joblib.dump(le, config.LABEL_ENCODER)

# Feature columns
feature_columns = [
    'weight_diff_pct', 'weight_underreported', 'weight_overreported',
    'value_per_kg', 'log_value', 'is_extreme_value',
    'dwell_flag_80', 'dwell_flag_120',
    'hs_chapter', 'hs_chapter_risk',
    'hour', 'is_weekend', 'is_off_hours', 'month',
    'is_high_risk_origin',
    'exporter_risk_score', 'importer_risk_score',
    'weight_value_interaction', 'risk_origin_dwell'
]

print(f"\n📊 Using {len(feature_columns)} features for modeling:")
missing = [f for f in feature_columns if f not in historical_df.columns]
if missing:
    print(f"❌ Missing features: {missing}")
    raise SystemExit(1)
for feat in feature_columns:
    print(f"   ✅ {feat}")

X = historical_df[feature_columns].copy()
y = historical_df['risk_level_encoded'].copy()

X = X.replace([np.inf, -np.inf], np.nan)
if X.isnull().sum().sum() > 0:
    print(f"\n⚠️ Filling {X.isnull().sum().sum()} NaN values with median...")
    X = X.fillna(X.median())

# Scale features
print("\n📏 Scaling features...")
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
X_scaled = pd.DataFrame(X_scaled, columns=feature_columns, index=X.index)
joblib.dump(scaler, config.SCALER)

# Train/val/test split (70/15/15)
print("\n✂️ Splitting data...")
X_temp, X_test, y_temp, y_test = train_test_split(
    X_scaled, y, test_size=0.15, random_state=42, stratify=y)
X_train, X_val, y_train, y_val = train_test_split(
    X_temp, y_temp, test_size=0.15 / 0.85, random_state=42, stratify=y_temp)

print(f"\n📊 Final split sizes:")
print(f"   Train: {len(X_train):,} ({len(X_train)/len(X)*100:.1f}%)")
print(f"   Val:   {len(X_val):,}   ({len(X_val)/len(X)*100:.1f}%)")
print(f"   Test:  {len(X_test):,}  ({len(X_test)/len(X)*100:.1f}%)")

class_weights = compute_class_weight('balanced', classes=np.unique(y_train), y=y_train)
print(f"\n⚖️ Class weights: {dict(zip(np.unique(y_train), class_weights))}")

joblib.dump((X_train, y_train, X_val, y_val, X_test, y_test), config.PREPARED_DATA)
joblib.dump(feature_columns, config.FEATURE_COLUMNS)
print("\n✅ PHASE 1 COMPLETE! Ready for modeling.")
