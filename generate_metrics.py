"""
generate_metrics.py — SmartContainer Risk Engine
Evaluation Metrics & Visualization Generator

Reads prediction outputs and produces:
  - Metrics summary (JSON + printed table)
  - Confusion matrix heatmap (PNG)
  - Classification report (TXT)
  - Risk score distribution histogram (PNG)
  - Class distribution bar chart (PNG)
  - Per-class precision/recall/F1 comparison chart (PNG)
  - Anomaly detection rate

Usage:
    python generate_metrics.py
"""

import os
import json

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)

# ── Constants ─────────────────────────────────────────────────────────────

PREDICTIONS_PATH = os.path.join("outputs", "predictions.csv")
OUTPUT_DIR = "outputs"
CLASS_LABELS = ["Clear", "Low Risk", "Critical"]

# Colour palette matching the dashboard theme
CLASS_COLOURS = {"Clear": "#10b981", "Low Risk": "#f59e0b", "Critical": "#ef4444"}


# ── 0. Ensure output folder exists ───────────────────────────────────────

def ensure_output_dir() -> None:
    """Create the outputs/ folder if it doesn't already exist."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)


# ── 1. Load predictions ──────────────────────────────────────────────────

def load_predictions(path: str = PREDICTIONS_PATH) -> pd.DataFrame:
    """
    Load the predictions CSV.

    Expected columns: actual_label, predicted_label, risk_score
    Optional column:  anomaly_flag
    """
    df = pd.read_csv(path)
    required = {"actual_label", "predicted_label", "risk_score"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")
    print(f"Loaded {len(df):,} predictions from {path}")
    return df


# ── 2. Calculate metrics ─────────────────────────────────────────────────

def calculate_metrics(df: pd.DataFrame) -> dict:
    """
    Compute evaluation metrics from actual vs predicted labels.

    Returns a dict containing macro/weighted F1, per-class precision,
    recall, F1, and the Critical-specific recall.
    """
    y_true = df["actual_label"]
    y_pred = df["predicted_label"]

    macro_f1 = f1_score(y_true, y_pred, labels=CLASS_LABELS, average="macro")
    weighted_f1 = f1_score(y_true, y_pred, labels=CLASS_LABELS, average="weighted")

    precision_per = precision_score(y_true, y_pred, labels=CLASS_LABELS, average=None)
    recall_per = recall_score(y_true, y_pred, labels=CLASS_LABELS, average=None)
    f1_per = f1_score(y_true, y_pred, labels=CLASS_LABELS, average=None)

    # Build per-class dicts
    per_class = {}
    for i, label in enumerate(CLASS_LABELS):
        per_class[label] = {
            "precision": round(float(precision_per[i]), 4),
            "recall": round(float(recall_per[i]), 4),
            "f1_score": round(float(f1_per[i]), 4),
        }

    critical_idx = CLASS_LABELS.index("Critical")

    metrics = {
        "total_samples": len(df),
        "macro_f1_score": round(float(macro_f1), 4),
        "weighted_f1_score": round(float(weighted_f1), 4),
        "critical_recall": round(float(recall_per[critical_idx]), 4),
        "critical_precision": round(float(precision_per[critical_idx]), 4),
        "critical_f1": round(float(f1_per[critical_idx]), 4),
        "per_class": per_class,
    }

    # ── Pretty-print ──────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  SMARTCONTAINER RISK ENGINE — EVALUATION METRICS")
    print("=" * 60)
    print(f"  Total samples evaluated : {metrics['total_samples']:,}")
    print(f"  Macro F1 Score          : {metrics['macro_f1_score']:.4f}")
    print(f"  Weighted F1 Score       : {metrics['weighted_f1_score']:.4f}")
    print(f"  Critical Recall         : {metrics['critical_recall']:.4f}")
    print(f"  Critical Precision      : {metrics['critical_precision']:.4f}")
    print(f"  Critical F1             : {metrics['critical_f1']:.4f}")
    print("-" * 60)
    print(f"  {'Class':<12} {'Precision':>10} {'Recall':>10} {'F1-Score':>10}")
    print("-" * 60)
    for label in CLASS_LABELS:
        c = per_class[label]
        print(f"  {label:<12} {c['precision']:>10.4f} {c['recall']:>10.4f} {c['f1_score']:>10.4f}")
    print("=" * 60)

    return metrics


# ── 3. Save metrics summary ──────────────────────────────────────────────

def save_metrics_summary(metrics: dict) -> None:
    """Save metrics dict as a formatted JSON file."""
    path = os.path.join(OUTPUT_DIR, "metrics_summary.json")
    with open(path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"\n  Saved metrics summary → {path}")


# ── 4. Confusion matrix plot ─────────────────────────────────────────────

def plot_confusion_matrix(df: pd.DataFrame) -> None:
    """Generate and save a confusion matrix heatmap."""
    y_true = df["actual_label"]
    y_pred = df["predicted_label"]
    cm = confusion_matrix(y_true, y_pred, labels=CLASS_LABELS)

    fig, ax = plt.subplots(figsize=(8, 6))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=CLASS_LABELS,
        yticklabels=CLASS_LABELS,
        linewidths=0.5,
        ax=ax,
    )
    ax.set_xlabel("Predicted Label", fontsize=12)
    ax.set_ylabel("Actual Label", fontsize=12)
    ax.set_title("SmartContainer Risk Engine — Confusion Matrix", fontsize=14, pad=12)
    plt.tight_layout()

    path = os.path.join(OUTPUT_DIR, "confusion_matrix.png")
    fig.savefig(path, dpi=200)
    plt.close(fig)
    print(f"  Saved confusion matrix  → {path}")


# ── 5. Classification report ─────────────────────────────────────────────

def save_classification_report(df: pd.DataFrame) -> None:
    """Generate sklearn classification report and save to text file."""
    y_true = df["actual_label"]
    y_pred = df["predicted_label"]
    report = classification_report(y_true, y_pred, labels=CLASS_LABELS, digits=4)

    path = os.path.join(OUTPUT_DIR, "classification_report.txt")
    with open(path, "w") as f:
        f.write("SmartContainer Risk Engine — Classification Report\n")
        f.write("=" * 60 + "\n\n")
        f.write(report)
    print(f"  Saved classification report → {path}")


# ── 6. Risk score distribution plot ──────────────────────────────────────

def plot_risk_distribution(df: pd.DataFrame) -> None:
    """Plot histogram of risk_score coloured by predicted label."""
    fig, ax = plt.subplots(figsize=(10, 5))

    for label in CLASS_LABELS:
        subset = df[df["predicted_label"] == label]
        ax.hist(
            subset["risk_score"],
            bins=50,
            alpha=0.65,
            label=f"{label} ({len(subset):,})",
            color=CLASS_COLOURS[label],
            edgecolor="white",
            linewidth=0.3,
        )

    ax.set_xlabel("Risk Score (0–100)", fontsize=11)
    ax.set_ylabel("Number of Containers", fontsize=11)
    ax.set_title("Risk Score Distribution by Predicted Class", fontsize=13, pad=10)
    ax.legend(fontsize=10)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    plt.tight_layout()

    path = os.path.join(OUTPUT_DIR, "risk_score_distribution.png")
    fig.savefig(path, dpi=200)
    plt.close(fig)
    print(f"  Saved risk score distribution → {path}")


# ── 7. Class distribution plot ───────────────────────────────────────────

def plot_class_distribution(df: pd.DataFrame) -> None:
    """Bar chart showing count of containers per predicted risk class."""
    counts = df["predicted_label"].value_counts().reindex(CLASS_LABELS).fillna(0).astype(int)

    fig, ax = plt.subplots(figsize=(7, 5))
    bars = ax.bar(
        CLASS_LABELS,
        counts.values,
        color=[CLASS_COLOURS[l] for l in CLASS_LABELS],
        edgecolor="white",
        linewidth=1.2,
        width=0.55,
    )

    # Annotate counts on top of each bar
    for bar, count in zip(bars, counts.values):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + max(counts) * 0.01,
            f"{count:,}",
            ha="center",
            va="bottom",
            fontsize=12,
            fontweight="bold",
        )

    ax.set_ylabel("Number of Containers", fontsize=11)
    ax.set_title("Predicted Risk Class Distribution", fontsize=13, pad=10)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    plt.tight_layout()

    path = os.path.join(OUTPUT_DIR, "risk_class_distribution.png")
    fig.savefig(path, dpi=200)
    plt.close(fig)
    print(f"  Saved class distribution → {path}")


# ── 8. Per-class metrics comparison chart ─────────────────────────────────

def plot_class_metrics(metrics: dict) -> None:
    """Grouped bar chart comparing Precision, Recall, F1 for each class."""
    per_class = metrics["per_class"]
    metric_names = ["precision", "recall", "f1_score"]
    display_names = ["Precision", "Recall", "F1 Score"]

    x = np.arange(len(CLASS_LABELS))
    width = 0.22
    colours = ["#3b82f6", "#8b5cf6", "#06b6d4"]

    fig, ax = plt.subplots(figsize=(9, 5))

    for i, (m_key, m_label) in enumerate(zip(metric_names, display_names)):
        values = [per_class[label][m_key] for label in CLASS_LABELS]
        bars = ax.bar(x + i * width, values, width, label=m_label, color=colours[i])
        # Annotate values
        for bar, val in zip(bars, values):
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 0.01,
                f"{val:.3f}",
                ha="center",
                va="bottom",
                fontsize=8,
            )

    ax.set_xticks(x + width)
    ax.set_xticklabels(CLASS_LABELS, fontsize=11)
    ax.set_ylabel("Score", fontsize=11)
    ax.set_ylim(0, 1.12)
    ax.set_title("Per-Class Metrics Comparison", fontsize=13, pad=10)
    ax.legend(fontsize=10)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    plt.tight_layout()

    path = os.path.join(OUTPUT_DIR, "class_metrics_comparison.png")
    fig.savefig(path, dpi=200)
    plt.close(fig)
    print(f"  Saved class metrics chart → {path}")


# ── 9. Anomaly detection rate ─────────────────────────────────────────────

def calculate_anomaly_rate(df: pd.DataFrame) -> float:
    """
    Calculate the percentage of containers flagged as anomalies.

    Uses the anomaly_flag column if present; otherwise falls back to
    counting Critical + Low Risk as anomalous.
    """
    if "anomaly_flag" in df.columns:
        anomaly_count = int(df["anomaly_flag"].sum())
    else:
        anomaly_count = int((df["predicted_label"] != "Clear").sum())

    total = len(df)
    rate = (anomaly_count / total) * 100 if total > 0 else 0.0

    print(f"\n  Anomaly Detection Rate")
    print(f"  ─────────────────────")
    print(f"  Flagged containers : {anomaly_count:,} / {total:,}")
    print(f"  Anomaly rate       : {rate:.2f}%")

    return round(rate, 2)


# ── Main ──────────────────────────────────────────────────────────────────

def main() -> None:
    ensure_output_dir()

    # 1. Load data
    df = load_predictions()

    # 2. Calculate evaluation metrics
    metrics = calculate_metrics(df)

    # 3. Anomaly detection rate (append to metrics)
    anomaly_rate = calculate_anomaly_rate(df)
    metrics["anomaly_rate_pct"] = anomaly_rate

    # 4. Save metrics JSON
    save_metrics_summary(metrics)

    # 5. Generate all plots and reports
    print()
    plot_confusion_matrix(df)
    save_classification_report(df)
    plot_risk_distribution(df)
    plot_class_distribution(df)
    plot_class_metrics(metrics)

    print("\n" + "=" * 60)
    print("  All metrics and visualizations saved to outputs/")
    print("=" * 60)


if __name__ == "__main__":
    main()
