"""
SmartContainer Risk Engine – Full Pipeline Runner
Executes all steps in sequence. Run from the project root:
    python run_pipeline.py
"""
import subprocess
import sys
import os

STEPS = [
    ("Step 1 – Load & Explore",        "src/01_load_and_explore.py"),
    ("Step 2 – Feature Engineering",   "src/02_feature_engineering.py"),
    ("Step 3 – Prepare for Modeling",  "src/03_prepare_for_modeling.py"),
    ("Step 4 – Train XGBoost",         "src/04_train_xgboost.py"),
    ("Step 5 – Train Isolation Forest","src/05_train_isolation_forest.py"),
    ("Step 6 – Ensemble & Threshold",  "src/06_ensemble_and_threshold.py"),
    ("Step 7 – Generate Predictions",  "src/07_generate_predictions.py"),
]


def run_step(label: str, script: str) -> bool:
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    result = subprocess.run(
        [sys.executable, os.path.join(os.path.dirname(__file__), script)],
        cwd=os.path.dirname(__file__)
    )
    if result.returncode != 0:
        print(f"\n❌ {label} failed (exit code {result.returncode}). Aborting.")
        return False
    return True


if __name__ == "__main__":
    print("🚢 SmartContainer Risk Engine – Starting Pipeline")

    for label, script in STEPS:
        if not run_step(label, script):
            sys.exit(1)

    print(f"\n{'='*60}")
    print("  ✅  Pipeline complete!")
    print(f"{'='*60}")
    print("\nTo launch the dashboard, run:")
    print("  streamlit run src/dashboard.py\n")
