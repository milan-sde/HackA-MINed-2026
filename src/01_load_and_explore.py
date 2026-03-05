"""
01 - Load and Explore Data
SmartContainer Risk Engine – Phase 1, Step 1
"""
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import warnings
warnings.filterwarnings('ignore')

import sys, os
sys.path.insert(0, os.path.dirname(__file__))
import config

print("=" * 60)
print("SMARTCONTAINER RISK ENGINE - PHASE 1: FOUNDATION")
print("=" * 60)

# Load the data
historical_df = pd.read_csv(config.HISTORICAL_RAW)
realtime_df   = pd.read_csv(config.REALTIME_RAW)

print(f"\n📊 Historical Data: {len(historical_df):,} rows")
print(f"📊 Real-time Data:  {len(realtime_df):,} rows")

# Target distribution
target_dist = historical_df['Clearance_Status'].value_counts()
target_pct  = historical_df['Clearance_Status'].value_counts(normalize=True) * 100

print("\n🎯 TARGET VARIABLE DISTRIBUTION:")
print("-" * 40)
for status, count in target_dist.items():
    print(f"{status:12s}: {count:6,d} rows ({target_pct[status]:.1f}%)")

print("\n✅ Blueprint Verification:")
print(f"Clear:    42,347 rows (78.4%) - Matches? {target_dist.get('Clear', 0) == 42347}")
print(f"Low Risk: 11,108 rows (20.6%) - Matches? {target_dist.get('Low Risk', 0) == 11108}")
print(f"Critical:    545 rows  (1.0%) - Matches? {target_dist.get('Critical', 0) == 545}")

print("\n📋 Historical Data Columns:")
print(historical_df.columns.tolist())

print("\n📋 Real-time Data Columns:")
print(realtime_df.columns.tolist())

print("\n🔍 Missing Values in Historical Data:")
print(historical_df.isnull().sum()[historical_df.isnull().sum() > 0])

print("\n🔍 Missing Values in Real-time Data:")
print(realtime_df.isnull().sum()[realtime_df.isnull().sum() > 0])

print("\n💡 KEY INSIGHTS FROM BLUEPRINT:")
print("-" * 40)
print("• Critical containers avg 22% weight discrepancy vs 3% for Clear")
print("• Critical dwell time avg 86.9 hrs vs 40.5 hrs for Clear")
print("• CN origin = 65% of all Critical containers")
print("• HS chapters 85, 95, 84, 90 = highest Critical volume")
print("• Repeat exporter DWNJQL8 had 8 Critical shipments")
print("• Class imbalance: Critical is only 1% - WILL need class_weight or SMOTE")
