"""
02 - Feature Engineering
SmartContainer Risk Engine – Phase 1, Step 2
"""
import pandas as pd
import numpy as np
from datetime import datetime
import joblib
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import config

print("=" * 60)
print("PHASE 1 - STEP 2: FEATURE ENGINEERING")
print("=" * 60)


def engineer_features(df, is_training=True):
    """Complete feature engineering as specified in blueprint."""
    print("🛠️  Engineering features...")
    df = df.copy()

    # 1. WEIGHT DISCREPANCY
    print("   - Weight discrepancy features")
    df['weight_diff'] = df['Measured_Weight'] - df['Declared_Weight']
    # weight_diff_pct = (measured_weight - declared_weight) / declared_weight
    df['weight_diff_pct'] = (df['Measured_Weight'] - df['Declared_Weight']) / (df['Declared_Weight'] + 0.001)
    df['weight_underreported'] = (df['Measured_Weight'] > df['Declared_Weight'] * 1.2).astype(int)
    df['weight_overreported']  = (df['Declared_Weight'] > df['Measured_Weight'] * 1.2).astype(int)

    # 2. VALUE RATIOS
    print("   - Value ratio features")
    df['value_per_kg'] = df['Declared_Value'] / (df['Declared_Weight'] + 0.001)
    df['log_value']    = np.log1p(df['Declared_Value'])

    # 3. DWELL TIME FLAGS
    print("   - Dwell time features")
    # dwell_time = dwell_time_hours (raw dwell time feature)
    df['dwell_time'] = df['Dwell_Time_Hours']
    df['dwell_flag_80']  = (df['Dwell_Time_Hours'] > 80).astype(int)
    df['dwell_flag_120'] = (df['Dwell_Time_Hours'] > 120).astype(int)

    # 4. HS CODE FEATURES
    print("   - HS Code features")
    df['hs_code']    = df['HS_Code'].astype(str).str.zfill(10)
    df['hs_chapter'] = df['hs_code'].str[:2].astype(int)
    df['hs_heading'] = df['hs_code'].str[:4].astype(int)

    # 5. TIME FEATURES
    print("   - Time-based features")
    df['declaration_datetime'] = pd.to_datetime(
        df['Declaration_Date (YYYY-MM-DD)'] + ' ' + df['Declaration_Time']
    )
    df['hour']        = df['declaration_datetime'].dt.hour
    df['day_of_week'] = df['declaration_datetime'].dt.dayofweek
    df['month']       = df['declaration_datetime'].dt.month
    df['is_weekend']  = (df['day_of_week'] >= 5).astype(int)
    df['is_off_hours'] = ((df['hour'] < 6) | (df['hour'] > 22)).astype(int)

    # 6. HIGH-RISK ORIGIN
    print("   - Geographic risk features")
    high_risk_origins = ['CN', 'TH', 'KR', 'VN']
    df['is_high_risk_origin'] = df['Origin_Country'].isin(high_risk_origins).astype(int)

    # 7. VALUE OUTLIERS
    value_99th = df['Declared_Value'].quantile(0.99)
    df['is_extreme_value'] = (df['Declared_Value'] > value_99th).astype(int)

    # 8. BEHAVIORAL ENCODING
    print("   - Behavioral encoding features")
    if is_training:
        exp_risk = df.groupby('Exporter_ID')['Clearance_Status'].apply(
            lambda x: (x == 'Critical').mean()
        ).to_dict()
        imp_risk = df.groupby('Importer_ID')['Clearance_Status'].apply(
            lambda x: (x == 'Critical').mean()
        ).to_dict()
        hs_risk = df.groupby('hs_chapter')['Clearance_Status'].apply(
            lambda x: (x == 'Critical').mean()
        ).to_dict()

        df['exporter_risk_score'] = df['Exporter_ID'].map(exp_risk).fillna(0)
        df['importer_risk_score'] = df['Importer_ID'].map(imp_risk).fillna(0)
        df['hs_chapter_risk']     = df['hs_chapter'].map(hs_risk).fillna(0)
        # hs_code_risk = historical risk level of shipments with same HS code
        df['hs_code_risk']        = df['hs_chapter_risk']

        joblib.dump({'exporter_risk': exp_risk, 'importer_risk': imp_risk, 'hs_chapter_risk': hs_risk},
                    config.RISK_MAPPINGS)
    else:
        try:
            risk_mappings = joblib.load(config.RISK_MAPPINGS)
            df['exporter_risk_score'] = df['Exporter_ID'].map(risk_mappings['exporter_risk']).fillna(0)
            df['importer_risk_score'] = df['Importer_ID'].map(risk_mappings['importer_risk']).fillna(0)
            df['hs_chapter_risk']     = df['hs_chapter'].map(risk_mappings['hs_chapter_risk']).fillna(0)
            # hs_code_risk = historical risk level of shipments with same HS code
            df['hs_code_risk']        = df['hs_chapter_risk']
        except FileNotFoundError:
            print("   ⚠️ Warning: Risk mappings not found, using zeros")
            df['exporter_risk_score'] = 0
            df['importer_risk_score'] = 0
            df['hs_chapter_risk']     = 0
            df['hs_code_risk']        = 0

    # 9. INTERACTION FEATURES
    print("   - Interaction features")
    df['weight_value_interaction'] = df['weight_diff_pct'] * df['value_per_kg']
    df['risk_origin_dwell']        = df['is_high_risk_origin'] * df['dwell_flag_80']

    print("✅ Feature engineering complete!")
    print(f"   Total features created: {len(df.columns)}")
    return df


# Load raw data
try:
    historical_df = pd.read_csv(config.HISTORICAL_RAW)
    realtime_df   = pd.read_csv(config.REALTIME_RAW)
    print(f"✅ Loaded {len(historical_df):,} historical rows and {len(realtime_df):,} real-time rows")
except FileNotFoundError as e:
    print(f"❌ Error: {e}")
    raise SystemExit(1)

# Engineer features
historical_df = engineer_features(historical_df, is_training=True)
realtime_df   = engineer_features(realtime_df, is_training=False)

# Save engineered data
historical_df.to_csv(config.HISTORICAL_ENGINEERED, index=False)
realtime_df.to_csv(config.REALTIME_ENGINEERED, index=False)
print("\n💾 Saved engineered datasets!")

# Verify
test_load = pd.read_csv(config.HISTORICAL_ENGINEERED)
for feat in ['weight_diff_pct', 'value_per_kg', 'dwell_time', 'exporter_risk_score', 'importer_risk_score', 'hs_code_risk']:
    status = "✅" if feat in test_load.columns else "❌"
    print(f"   {status} {feat}")

print("\n✅ Step 2 complete! Proceed to step 3.")
