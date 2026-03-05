<div align="center">

# 🚢 SmartContainer Risk Engine

[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![XGBoost](https://img.shields.io/badge/XGBoost-1.7+-orange.svg)](https://xgboost.readthedocs.io/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> An AI/ML-based intelligent risk assessment system for containerized cargo that predicts shipment risk levels and provides explainable insights for customs authorities.

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Dataset](#-dataset)
- [Installation](#-installation)
- [Usage](#-usage)
- [Model Performance](#-model-performance)
- [Dashboard](#-dashboard)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)

## 🎯 Overview

Containerized cargo movement forms the backbone of global trade. Every day, ports and logistics authorities process thousands of containers carrying goods of varying origin, value, and compliance requirements. This project addresses the challenge of identifying potentially risky shipments while maintaining efficient trade flow.

**Key Objectives:**

- Process structured container shipment data
- Identify anomalous or suspicious shipment patterns
- Predict inspection risk for each container
- Categorize containers into multiple risk levels (Critical / Low Risk / Clear)
- Provide basic explainability for each prediction

## ✨ Features

### Core Features

- **🤖 ML-Based Risk Prediction** — XGBoost classifier with class imbalance handling (`scale_pos_weight=77`)
- **🔍 Anomaly Detection** — Isolation Forest for identifying unusual patterns
- **📊 Risk Categorization** — Multi-level risk classification (Critical / Low Risk / Clear)
- **💡 Explainability** — Rule-based natural language explanations per prediction
- **📈 Interactive Dashboard** — React web dashboard for real-time monitoring

### Technical Highlights

- **Ensemble Learning** — Combines XGBoost (60%), Isolation Forest (20%), and rule-based flags (20%)
- **Feature Engineering** — 19+ engineered features including behavioral profiling
- **Class Imbalance Handling** — `scale_pos_weight ≈ 77` for Critical class (1% of data)
- **Threshold Optimization** — Automated F1-based threshold tuning across 20–90 range
- **Modular Pipeline** — 7-step numbered scripts, runnable individually or via `run_pipeline.py`

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
├─────────────────────────────────────────────────────────────┤
│  Historical Data (54,000 rows)    │  Real-time Data (8,481)  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  FEATURE ENGINEERING                         │
├─────────────────────────────────────────────────────────────┤
│  • Weight Discrepancy (weight_diff_pct)                     │
│  • Value/Weight Ratio (value_per_kg)                        │
│  • Behavioral Profiling (exporter/importer risk scores)     │
│  • Temporal Features (hour, weekend, month)                 │
│  • Geographic Risk (high-risk origins)                      │
│  • HS Code Analysis (chapter-level risk)                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      MODEL LAYER                             │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   XGBoost    │  │  Isolation   │  │    Rule      │      │
│  │  Classifier  │  │   Forest     │  │    Based     │      │
│  │  (Primary)   │  │  (Anomaly)   │  │  (Heuristic) │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │    60%          │    20%          │    20%         │
│         └─────────────────┼─────────────────┘               │
│                           ↓                                  │
│              ┌─────────────────────────┐                    │
│              │  ENSEMBLE (60/20/20)    │                    │
│              │  Risk Score: 0 – 100    │                    │
│              └─────────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  EXPLAINABILITY LAYER                        │
├─────────────────────────────────────────────────────────────┤
│  • Top risk factors identification                          │
│  • Natural language explanation generation                  │
│  • Per-container Explanation_Summary column                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    OUTPUT LAYER                              │
├─────────────────────────────────────────────────────────────┤
│  • predictions.csv (Risk Score, Level, Explanation)         │
│  • React + TypeScript Web Dashboard                         │
└─────────────────────────────────────────────────────────────┘
```

## 📊 Dataset

### Source Data

| Dataset | Rows | Purpose |
|---------|------|---------|
| Historical Data | 54,000 | Training & validation |
| Real-time Data | 8,481 | Inference |

### Target Distribution

| Risk Level | Count | Percentage |
|------------|-------|------------|
| Clear | 42,347 | 78.4% |
| Low Risk | 11,108 | 20.6% |
| Critical | 545 | 1.0% |

### Key Features

| Feature | Description | Importance |
|---------|-------------|------------|
| `weight_diff_pct` | % difference between measured and declared weight | HIGH |
| `value_per_kg` | Declared value per kilogram | HIGH |
| `dwell_flag_80` | Dwell time > 80 hours | HIGH |
| `exporter_risk_score` | Historical critical rate per exporter | HIGH |
| `hs_chapter_risk` | Risk rate per HS chapter | MEDIUM |
| `is_high_risk_origin` | Origin in [CN, TH, KR, VN] | MEDIUM |
| `importer_risk_score` | Historical critical rate per importer | MEDIUM |
| `is_extreme_value` | Declared value above 99th percentile | MEDIUM |
| `is_off_hours` | Declaration outside 06:00–22:00 | LOW |
| `is_weekend` | Declaration on Saturday/Sunday | LOW |

## 💻 Installation

### Prerequisites

- Python 3.8+
- Node.js 18+ *(for the React dashboard)*
- pip package manager

### Step-by-Step Installation

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/HackaMinded.git
cd HackaMinded

# 2. Create virtual environment (recommended)
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS / Linux

# 3. Install Python dependencies
pip install -r requirements.txt
```

### Python Requirements

```
pandas>=1.5.0
numpy>=1.23.0
scikit-learn>=1.1.0
xgboost>=1.7.0
matplotlib>=3.5.0
seaborn>=0.12.0
joblib>=1.2.0
```

## 🚀 Usage

### Quick Start — Full Pipeline

```bash
# Place your data files in data/raw/
#   - Historical_Data.csv
#   - Real_Time_Data.csv

# Run the complete pipeline (all 7 steps)
python run_pipeline.py
```

### Run Steps Individually

```bash
python src/01_load_and_explore.py       # Load data & statistical overview
python src/02_feature_engineering.py     # Create 19+ engineered features
python src/03_prepare_for_modeling.py    # Encode, scale, train/val/test split
python src/04_train_xgboost.py          # Train XGBoost classifier
python src/05_train_isolation_forest.py  # Train Isolation Forest
python src/06_ensemble_and_threshold.py  # Ensemble scoring & threshold search
python src/07_generate_predictions.py    # Score real-time containers
```

### Launch the Dashboard

```bash
cd dashboard
npm install
npm run dev
```

### Jupyter Notebook

For interactive exploration, open the end-to-end notebook:

```bash
jupyter notebook notebooks/Code.ipynb
```

### Output Format

The system generates `data/processed/predictions.csv`:

| Column | Type | Description |
|--------|------|-------------|
| `Container_ID` | int | Unique container identifier |
| `Risk_Score` | float | 0–100 risk score |
| `Risk_Level` | string | Critical / Low Risk / Clear |
| `Anomaly_Flag` | int | 1 if anomaly detected |
| `Explanation_Summary` | string | Human-readable explanation |

## 📈 Model Performance

### Validation Results

| Metric | Value |
|--------|-------|
| Accuracy | ~99% |
| Critical Class Recall | ~93% |
| Critical Class Precision | ~96% |
| F1-Score (Critical) | ~0.94 |
| Macro F1-Score | ~0.98 |

### Confusion Matrix

```
                 Predicted
               Clear  Critical  Low Risk
Actual Clear    6353       0         0
Actual Critical    4      76         2
Actual Low Risk   14       0      1652
```

### Feature Importance (Top 5)

1. `weight_diff_pct` — Weight discrepancy percentage
2. `exporter_risk_score` — Historical exporter risk
3. `value_per_kg` — Value to weight ratio
4. `hs_chapter_risk` — HS code risk level
5. `dwell_flag_80` — Extended dwell time

## 📊 Dashboard

A modern single-page application built with React 19, TypeScript, Tailwind CSS, and Recharts:

| Page | Description |
|------|-------------|
| **Overview** | Live KPIs, risk timeline chart, donut chart, sortable containers table |
| **Containers** | Searchable & filterable container list with detail modals |
| **Analytics** | Risk distribution analysis and anomaly pattern breakdowns |
| **Reports** | Exportable insights and summaries |
| **Settings** | Configuration panel |

```bash
cd dashboard && npm install && npm run dev
```

## 📁 Project Structure

```
HackaMinded/
├── data/
│   ├── raw/                          # Original, immutable input data
│   │   ├── Historical_Data.csv
│   │   └── Real_Time_Data.csv
│   └── processed/                    # Engineered & output data
│       ├── Historical_Engineered.csv
│       ├── Realtime_Engineered.csv
│       ├── predictions.csv
│       └── threshold_analysis.csv
├── models/                           # Serialized model artifacts (.pkl)
│   ├── xgboost_model.pkl
│   ├── isolation_forest.pkl
│   ├── scaler.pkl
│   ├── label_encoder.pkl
│   ├── feature_columns.pkl
│   ├── prepared_data.pkl
│   ├── risk_mappings.pkl
│   ├── best_threshold.pkl
│   ├── val_anomaly_scores.pkl
│   └── ensemble_info.pkl
├── notebooks/
│   └── Code.ipynb                    # End-to-end exploratory notebook
├── outputs/                          # Generated plots & figures
│   ├── confusion_matrix.png
│   └── threshold_optimization.png
├── src/                              # ML pipeline scripts
│   ├── config.py                     # Centralised path configuration
│   ├── 01_load_and_explore.py
│   ├── 02_feature_engineering.py
│   ├── 03_prepare_for_modeling.py
│   ├── 04_train_xgboost.py
│   ├── 05_train_isolation_forest.py
│   ├── 06_ensemble_and_threshold.py
│   └── 07_generate_predictions.py
├── dashboard/                        # React + TypeScript web dashboard
│   ├── src/
│   │   ├── pages/                    # Overview, Containers, Analytics, Reports, Settings
│   │   ├── components/               # Reusable UI & dashboard components
│   │   ├── data/                     # Data service & mock data
│   │   ├── store/                    # Zustand state management
│   │   └── types/                    # TypeScript type definitions
│   ├── package.json
│   └── vite.config.ts
├── run_pipeline.py                   # One-click full pipeline runner
├── requirements.txt                  # Python dependencies
└── README.md
```

## 🧪 Pipeline Steps

| Step | Script | Description |
|------|--------|-------------|
| 1 | `01_load_and_explore.py` | Load raw CSV data and print statistical overview |
| 2 | `02_feature_engineering.py` | Create 19+ engineered features (weight diff %, dwell flags, behavioral risk scores, time features, geographic risk, HS code analysis, value outliers) |
| 3 | `03_prepare_for_modeling.py` | Encode categoricals, scale features, perform train/val/test split |
| 4 | `04_train_xgboost.py` | Train XGBoost classifier with `scale_pos_weight ≈ 77`, save confusion matrix |
| 5 | `05_train_isolation_forest.py` | Train Isolation Forest anomaly detector |
| 6 | `06_ensemble_and_threshold.py` | Combine models into weighted ensemble (60/20/20), optimize decision threshold via F1 sweep |
| 7 | `07_generate_predictions.py` | Score all real-time containers, generate explanations, export `predictions.csv` |

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 🙏 Acknowledgments

- Dataset provided by the hackathon organizers
- Inspired by real-world customs risk assessment needs
- Built with open-source tools and libraries

---

## 🏆 Key Achievements

- **~99% Accuracy** on validation set
- **~93% Recall** for Critical risk containers
- **19+ Engineered Features** from raw data
- **Ensemble Model** combining 3 different approaches
- **Explainable AI** with per-prediction natural language explanations
- **React Dashboard** — Modern TypeScript SPA with Recharts & Tailwind CSS
- **One-Click Pipeline** — `python run_pipeline.py`

---

<div align="center">
  <sub>Built with ❤️ for HackA MINed 2026</sub>
</div>
