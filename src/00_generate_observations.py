"""
00 - Generate Observation Plots
SmartContainer Risk Engine – Data Exploration & Anomaly Justification

Generates presentation-ready plots that justify the anomaly detection logic.
"""
import json
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
import sys, os

sys.path.insert(0, os.path.dirname(__file__))
import config

# ── Style ─────────────────────────────────────────────────
sns.set_theme(style="whitegrid", font_scale=1.15)
PALETTE = sns.color_palette("coolwarm", 6)
os.makedirs(config.OUTPUTS_DIR, exist_ok=True)

print("=" * 60)
print("OBSERVATION PLOTS – DATA EXPLORATION")
print("=" * 60)

df = pd.read_csv(config.HISTORICAL_ENGINEERED)
print(f"✅ Loaded {len(df):,} rows from Historical_Engineered.csv\n")

# ── Obs 1: Weight Discrepancy Distribution ────────────────
print("📊 1/6  Weight discrepancy distribution …")
fig, ax = plt.subplots(figsize=(10, 5))
data = df["weight_diff_pct"].clip(-2, 2)  # clip for display
ax.hist(data, bins=80, color=PALETTE[0], edgecolor="white", alpha=0.85)
ax.axvline(0.30, color="red", ls="--", lw=1.5, label="Threshold +30 %")
ax.axvline(-0.30, color="red", ls="--", lw=1.5, label="Threshold −30 %")
extreme = (df["weight_diff_pct"].abs() > 0.30).sum()
ax.set_title(
    f"Weight Discrepancy Distribution  ({extreme:,} containers > ±30 %)",
    fontsize=14, fontweight="bold",
)
ax.set_xlabel("weight_diff_pct  (measured − declared) / declared")
ax.set_ylabel("Number of Containers")
ax.legend(fontsize=10)
plt.tight_layout()
fig.savefig(os.path.join(config.OUTPUTS_DIR, "obs_01_weight_discrepancy_distribution.png"),
            dpi=150, bbox_inches="tight")
plt.close(fig)
print("   ✅ saved obs_01_weight_discrepancy_distribution.png")

# ── Obs 2: Value per kg Outliers ──────────────────────────
print("📊 2/6  Value per kg outliers …")
fig, axes = plt.subplots(1, 2, figsize=(13, 5), gridspec_kw={"width_ratios": [2, 1]})
# Histogram
q99 = df["value_per_kg"].quantile(0.99)
clipped = df["value_per_kg"].clip(upper=q99 * 1.3)
axes[0].hist(clipped, bins=80, color=PALETTE[1], edgecolor="white", alpha=0.85)
axes[0].axvline(q99, color="red", ls="--", lw=1.5, label=f"99th pctl = {q99:.1f}")
axes[0].set_title("Value per kg – Distribution", fontsize=13, fontweight="bold")
axes[0].set_xlabel("value_per_kg  (Declared Value / Measured Weight)")
axes[0].set_ylabel("Number of Containers")
axes[0].legend(fontsize=10)
# Boxplot by risk level
order = ["Clear", "Low Risk", "Critical"]
present = [o for o in order if o in df["Clearance_Status"].unique()]
sns.boxplot(data=df, x="Clearance_Status", y="value_per_kg", hue="Clearance_Status",
            order=present, hue_order=present, palette="coolwarm",
            ax=axes[1], showfliers=False, legend=False)
axes[1].set_title("Value per kg – by Risk Level", fontsize=13, fontweight="bold")
axes[1].set_xlabel("Clearance Status")
axes[1].set_ylabel("value_per_kg")
plt.tight_layout()
fig.savefig(os.path.join(config.OUTPUTS_DIR, "obs_02_value_per_kg_outliers.png"),
            dpi=150, bbox_inches="tight")
plt.close(fig)
print("   ✅ saved obs_02_value_per_kg_outliers.png")

# ── Obs 3: Dwell Time Distribution ───────────────────────
print("📊 3/6  Dwell time distribution …")
fig, ax = plt.subplots(figsize=(10, 5))
ax.hist(df["Dwell_Time_Hours"], bins=80, color=PALETTE[2], edgecolor="white", alpha=0.85)
ax.axvline(80, color="orange", ls="--", lw=1.5, label="80 h flag")
ax.axvline(120, color="red", ls="--", lw=1.5, label="120 h flag")
long_dwell = (df["Dwell_Time_Hours"] > 120).sum()
ax.set_title(
    f"Dwell Time Distribution  ({long_dwell:,} containers > 120 h)",
    fontsize=14, fontweight="bold",
)
ax.set_xlabel("Dwell Time (hours)")
ax.set_ylabel("Number of Containers")
ax.legend(fontsize=10)
plt.tight_layout()
fig.savefig(os.path.join(config.OUTPUTS_DIR, "obs_03_dwell_time_distribution.png"),
            dpi=150, bbox_inches="tight")
plt.close(fig)
print("   ✅ saved obs_03_dwell_time_distribution.png")

# ── Obs 4: Exporter Risk Distribution ────────────────────
print("📊 4/6  Exporter risk distribution …")
exp_stats = (
    df.groupby("Exporter_ID")
    .agg(total=("Clearance_Status", "size"),
         critical=("Clearance_Status", lambda x: (x == "Critical").sum()))
    .query("total >= 5")
)
exp_stats["critical_rate"] = exp_stats["critical"] / exp_stats["total"]
top20 = exp_stats.nlargest(20, "critical_rate")

fig, ax = plt.subplots(figsize=(12, 6))
bars = ax.barh(top20.index.astype(str), top20["critical_rate"], color=PALETTE[3])
ax.set_xlabel("Critical Shipment Rate")
ax.set_ylabel("Exporter ID")
ax.set_title("Top 20 Exporters by Critical Shipment Rate  (min 5 shipments)",
             fontsize=14, fontweight="bold")
for bar, val in zip(bars, top20["critical_rate"]):
    ax.text(bar.get_width() + 0.005, bar.get_y() + bar.get_height() / 2,
            f"{val:.1%}", va="center", fontsize=9)
ax.invert_yaxis()
plt.tight_layout()
fig.savefig(os.path.join(config.OUTPUTS_DIR, "obs_04_exporter_risk_distribution.png"),
            dpi=150, bbox_inches="tight")
plt.close(fig)
print("   ✅ saved obs_04_exporter_risk_distribution.png")

# ── Obs 5: HS Code Risk Levels ───────────────────────────
print("📊 5/6  HS code risk patterns …")
hs_stats = (
    df.groupby("hs_chapter")
    .agg(total=("Clearance_Status", "size"),
         critical=("Clearance_Status", lambda x: (x == "Critical").sum()))
)
hs_stats["critical_rate"] = hs_stats["critical"] / hs_stats["total"]
hs_stats = hs_stats.sort_values("critical_rate", ascending=False).head(25)

fig, ax = plt.subplots(figsize=(12, 6))
colors = ["#d7191c" if r > 0.03 else "#fdae61" if r > 0.01 else "#1a9641"
          for r in hs_stats["critical_rate"]]
ax.bar(hs_stats.index.astype(str), hs_stats["critical_rate"], color=colors,
       edgecolor="white")
ax.set_xlabel("HS Chapter")
ax.set_ylabel("Critical Shipment Rate")
ax.set_title("Risk Rate by HS Chapter  (top 25)", fontsize=14, fontweight="bold")
ax.tick_params(axis="x", rotation=45)
# Legend
from matplotlib.patches import Patch
legend_items = [Patch(color="#d7191c", label="High (>3 %)"),
                Patch(color="#fdae61", label="Medium (1–3 %)"),
                Patch(color="#1a9641", label="Low (<1 %)")]
ax.legend(handles=legend_items, title="Risk Tier", fontsize=10)
plt.tight_layout()
fig.savefig(os.path.join(config.OUTPUTS_DIR, "obs_05_hs_code_risk_levels.png"),
            dpi=150, bbox_inches="tight")
plt.close(fig)
print("   ✅ saved obs_05_hs_code_risk_levels.png")

# ── Obs 6: Confusion Matrix ──────────────────────────────
print("📊 6/6  Confusion matrix …")
metrics_path = config.MODEL_METRICS
with open(metrics_path) as f:
    metrics = json.load(f)
cm = np.array(metrics["confusion_matrix"])
class_names = metrics["class_names"]

fig, ax = plt.subplots(figsize=(7, 6))
sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
            xticklabels=class_names, yticklabels=class_names, ax=ax,
            linewidths=0.5, linecolor="white")
ax.set_title("XGBoost Confusion Matrix – Validation Set",
             fontsize=14, fontweight="bold")
ax.set_xlabel("Predicted Label")
ax.set_ylabel("Actual Label")
# Add summary text
total = cm.sum()
correct = np.trace(cm)
ax.text(0.5, -0.12, f"Accuracy: {correct/total:.2%}  |  "
        f"Macro F1: {metrics['macro_f1_score']:.4f}  |  "
        f"Critical Recall: {metrics['recall_critical']:.4f}",
        transform=ax.transAxes, ha="center", fontsize=11, style="italic")
plt.tight_layout()
fig.savefig(os.path.join(config.OUTPUTS_DIR, "obs_06_confusion_matrix.png"),
            dpi=150, bbox_inches="tight")
plt.close(fig)
print("   ✅ saved obs_06_confusion_matrix.png")

print("\n" + "=" * 60)
print("✅ All 6 observation plots saved to outputs/")
print("=" * 60)
