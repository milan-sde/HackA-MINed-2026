<div align="center">

# SmartContainer Risk Engine

### AI-Powered Container Risk Assessment for Customs Authorities

[![Python 3.8+](https://img.shields.io/badge/Python-3.8+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![XGBoost](https://img.shields.io/badge/XGBoost-1.7+-FF6600)](https://xgboost.readthedocs.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

SmartContainer Risk Engine is an end-to-end AI/ML system that predicts risk levels for containerized cargo shipments and helps customs authorities prioritize physical inspections. It combines an XGBoost classifier, an Isolation Forest anomaly detector, and rule-based heuristics into a weighted ensemble model that scores every container on a 0–100 risk scale, categorizes it as **Critical**, **Low Risk**, or **Clear**, and generates a human-readable explanation for each prediction. A FastAPI backend serves these predictions to a React + TypeScript dashboard where customs officers can monitor container flow in real time, review AI explanations, flag containers for inspection, and manage an inspection workflow — all from a single interface.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Solution Overview](#2-solution-overview)
3. [System Architecture](#3-system-architecture)
4. [Data Pipeline](#4-data-pipeline)
5. [Feature Engineering](#5-feature-engineering)
6. [Machine Learning Models](#6-machine-learning-models)
7. [Risk Scoring System](#7-risk-scoring-system)
8. [Explainable AI](#8-explainable-ai)
9. [Backend System](#9-backend-system)
10. [Frontend Dashboard](#10-frontend-dashboard)
11. [Inspection Workflow](#11-inspection-workflow)
12. [Real-Time Monitoring](#12-real-time-monitoring)
13. [Dashboard Analytics](#13-dashboard-analytics)
14. [Deployment Architecture](#14-deployment-architecture)
15. [Key Achievements](#15-key-achievements)
16. [Future Improvements](#16-future-improvements)
17. [Conclusion](#17-conclusion)

---

## 1. Problem Statement

Global maritime trade moves over **800 million containers per year**. At any given port, thousands of containers arrive daily carrying goods of varying origin, value, and compliance risk. Customs authorities face a fundamental challenge: **they cannot physically inspect every container**, yet missing a high-risk shipment — whether it involves undervaluation, weight fraud, or prohibited goods — has serious economic and security consequences.

### Current Challenges

| Challenge | Impact |
|-----------|--------|
| **Volume overwhelm** | Ports process thousands of containers daily; manual review of each is impossible |
| **Static rule-based systems** | Traditional threshold rules (e.g., "flag all containers from country X") generate excessive false positives and miss novel fraud patterns |
| **Imbalanced risk distribution** | Only ~1% of containers are truly Critical, making detection a needle-in-a-haystack problem |
| **No behavioral profiling** | Legacy systems don't track exporter/importer risk histories or cross-reference shipment patterns |
| **Lack of explainability** | Officers receive a "flag" with no reasoning, making it difficult to prioritize or justify inspections |

### Why AI Is Needed

Customs authorities need a system that can:

- **Learn from historical inspection outcomes** to identify what makes a shipment suspicious
- **Detect anomalies** that rule-based systems miss (unusual weight-to-value ratios, off-hours declarations, dwell time spikes)
- **Rank containers by risk** so officers focus on the highest-priority shipments first
- **Explain its reasoning** so that flagging decisions are transparent and auditable
- **Operate in real time** to keep pace with container arrivals at the port

---

## 2. Solution Overview

SmartContainer Risk Engine is a full-stack AI system that addresses every stage of the container risk assessment pipeline — from raw shipment data to actionable inspection decisions.

### Core Capabilities

```
┌──────────────────────────────────────────────────────────────────┐
│                    SmartContainer Risk Engine                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│   🤖 AI Risk Prediction        Risk scoring for every container   │
│   🔍 Anomaly Detection         Isolation Forest for outliers      │
│   📊 Risk Categorization       Critical / Low Risk / Clear        │
│   💡 Explainable AI            Natural language explanations      │
│   📡 Real-Time Monitoring      Live container ingestion           │
│   🛡️ Inspection Workflow       Flag, review, and track actions    │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### How It Improves Customs Operations

| Without SmartContainer | With SmartContainer |
|------------------------|---------------------|
| Random or rule-based inspection selection | AI-prioritized risk ranking with 93% recall on Critical containers |
| No explanation for why a container is flagged | Per-container natural language explanations and top risk factors |
| Batch processing with delays | Real-time scoring as containers arrive |
| No historical pattern tracking | Exporter/importer behavioral risk profiling |
| Paper-based inspection notes | Digital inspection queue with notes, flagging, and audit trail |

---

## 3. System Architecture

The system follows a layered architecture with clear separation of concerns between the frontend presentation layer, the backend API layer, and the ML inference engine.

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                           │
│                                                                   │
│   React 19 + TypeScript + Tailwind CSS + Recharts                │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│   │ Overview  │ │Containers│ │Analytics │ │Inspection Queue  │   │
│   └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│                         ↕ HTTP/REST                               │
├─────────────────────────────────────────────────────────────────┤
│                       API LAYER                                   │
│                                                                   │
│   FastAPI + Uvicorn                                              │
│   ┌──────────┐ ┌──────────────┐ ┌────────────┐ ┌────────────┐  │
│   │ /predict  │ │/predict-batch│ │/containers │ │/flag + notes│  │
│   └──────────┘ └──────────────┘ └────────────┘ └────────────┘  │
│                         ↕                                         │
├─────────────────────────────────────────────────────────────────┤
│                    INFERENCE LAYER                                │
│                                                                   │
│   Feature Engineering → Scaling → Model Ensemble → Scoring       │
│                                                                   │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│   │   XGBoost    │  │  Isolation   │  │  Rule-Based  │          │
│   │  Classifier  │  │   Forest     │  │   Heuristics │          │
│   │    (60%)     │  │    (20%)     │  │    (20%)     │          │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│          └─────────────────┼─────────────────┘                   │
│                            ↓                                      │
│              Ensemble Score (0–100)                               │
│              Risk Level + Explanation                             │
├─────────────────────────────────────────────────────────────────┤
│                      DATA LAYER                                   │
│                                                                   │
│   Historical Data (54,000 rows)  │  Real-Time Data (8,481 rows)  │
│   Models (.pkl)  │  Predictions (.csv)  │  Flags/Notes (.json)   │
└─────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| **Presentation** | React 19, TypeScript, Tailwind CSS, Recharts, Zustand | Dashboard UI, charts, tables, modals, real-time updates |
| **API** | FastAPI, Uvicorn, Pydantic | REST endpoints, request validation, file I/O, CORS |
| **Inference** | XGBoost, scikit-learn, NumPy, pandas | Feature engineering, model loading, ensemble scoring, explanation generation |
| **Data** | CSV files, JSON files, joblib-serialized models | Training data, predictions, flagged containers, notes |

---

## 4. Data Pipeline

### Source Datasets

The system operates on two datasets representing the full lifecycle of container risk assessment:

| Dataset | Rows | Purpose |
|---------|------|---------|
| **Historical Data** | 54,000 | Training, validation, and test data with known `Clearance_Status` labels |
| **Real-Time Data** | 8,481 | Unlabeled containers for live inference (simulates incoming shipments) |

### Container Record Schema

Each container record contains the following fields, representing a single customs declaration:

| Field | Type | Description |
|-------|------|-------------|
| `Container_ID` | Integer | Unique identifier for the container |
| `Declaration_Date` | Date | Date the customs declaration was filed |
| `Declaration_Time` | Time | Time the declaration was filed |
| `Trade_Regime` | String | Import, Export, or Transit |
| `Origin_Country` | String | ISO country code of shipment origin |
| `Destination_Port` | String | Port of arrival |
| `Destination_Country` | String | ISO country code of destination |
| `HS_Code` | String | Harmonized System code classifying the goods |
| `Importer_ID` | String | Unique identifier for the importing entity |
| `Exporter_ID` | String | Unique identifier for the exporting entity |
| `Declared_Value` | Float | Value declared by the shipper (in currency units) |
| `Declared_Weight` | Float | Weight declared by the shipper (in kg) |
| `Measured_Weight` | Float | Actual weight measured at the port (in kg) |
| `Dwell_Time_Hours` | Float | Hours the container has been at the port |
| `Shipping_Line` | String | Carrier / shipping line identifier |
| `Clearance_Status` | String | **Target label** — Clear, Low Risk, or Critical (historical only) |

### Target Distribution (Historical Data)

The dataset exhibits **severe class imbalance**, which is realistic for customs data — most shipments are legitimate:

| Risk Level | Count | Percentage |
|------------|-------|------------|
| **Clear** | 42,347 | 78.4% |
| **Low Risk** | 11,108 | 20.6% |
| **Critical** | 545 | **1.0%** |

### Data Flow

```
Raw CSV Files
      ↓
Feature Engineering (19 features created from raw fields)
      ↓
Train / Validation / Test Split (70% / 15% / 15%)
      ↓
Model Training (XGBoost + Isolation Forest)
      ↓
Threshold Optimization (F1 sweep across 20–85)
      ↓
Model Serialization (.pkl artifacts)
      ↓
FastAPI loads models at startup
      ↓
Incoming container → Feature Engineering → Ensemble Scoring → Prediction
```

### Data Splits

| Split | Rows | Clear | Critical | Low Risk |
|-------|------|-------|----------|----------|
| **Train** | 37,799 (70%) | 29,642 | 381 | 7,776 |
| **Validation** | 8,101 (15%) | 6,353 | 82 | 1,666 |
| **Test** | 8,100 (15%) | 6,352 | 82 | 1,666 |

---

## 5. Feature Engineering

Raw container fields are transformed into **19 engineered features** that capture the behavioral, temporal, geographic, and statistical patterns associated with high-risk shipments. These features are the core signal for the ML models.

### Feature Table

| Feature | Formula / Logic | Why It Matters |
|---------|----------------|----------------|
| **weight_diff_pct** | `abs(measured - declared) / declared × 100` | Weight discrepancies are the strongest signal for fraud. Critical containers average ~22% discrepancy vs ~3% for Clear |
| **weight_underreported** | `1` if `measured > declared × 1.2` | Detects when the actual weight significantly exceeds what was declared |
| **weight_overreported** | `1` if `declared > measured × 1.2` | Detects when declared weight is inflated to hide value-per-kg anomalies |
| **value_per_kg** | `declared_value / declared_weight` | Unusually high or low value-per-kg ratios indicate potential undervaluation or misclassification |
| **log_value** | `log(1 + declared_value)` | Log-scaled value for numerical stability in model training |
| **is_extreme_value** | `1` if `value > 99th percentile` | Flags outlier declared values based on the training distribution |
| **dwell_flag_80** | `1` if `dwell_time > 80 hours` | Extended port dwell time correlates with inspection holds or suspicious delays. Critical containers dwell ~87 hrs vs ~40 hrs for Clear |
| **dwell_flag_120** | `1` if `dwell_time > 120 hours` | Severe dwell time anomaly — strong indicator of held or problematic shipments |
| **hs_chapter** | First 2 digits of HS code | HS chapters 85, 95, 84, 90 have the highest Critical rates |
| **hs_chapter_risk** | Historical Critical rate per HS chapter | Encodes the risk profile of the commodity type being shipped |
| **hour** | Hour of declaration time | Temporal pattern — some risky shipments are filed at unusual hours |
| **is_weekend** | `1` if Saturday or Sunday | Weekend declarations may indicate attempts to avoid peak scrutiny |
| **is_off_hours** | `1` if `hour < 6` or `hour > 22` | Off-hours filings correlate with higher risk |
| **month** | Month of declaration date | Seasonal trade patterns |
| **is_high_risk_origin** | `1` if origin in `{CN, TH, KR, VN}` | ~65% of Critical containers originate from these four countries |
| **exporter_risk_score** | Historical Critical rate per exporter | Behavioral profiling — exporters with past Critical shipments are higher risk |
| **importer_risk_score** | Historical Critical rate per importer | Same behavioral profiling for the importing entity |
| **weight_value_interaction** | `weight_diff_pct × value_per_kg` | Captures the compound risk when both weight and value anomalies are present |
| **risk_origin_dwell** | `is_high_risk_origin × dwell_flag_80` | Captures the interaction between a risky origin and extended dwell time |

### Key Insights from Feature Analysis

- **Weight discrepancy** is the single strongest predictor — Critical containers have ~7× higher average discrepancy
- **Exporter behavioral profiling** captures repeat offenders (e.g., exporter `DWNJQL8` had 8 Critical shipments in the training data)
- **Geographic risk** is concentrated: China (CN), Thailand (TH), South Korea (KR), and Vietnam (VN) account for the majority of Critical shipments
- **Dwell time** acts as a real-time operational signal — containers held for extended periods at the port often have underlying issues

---

## 6. Machine Learning Models

The system uses **three complementary models** combined into a weighted ensemble. Each model captures a different aspect of risk.

### Model 1: XGBoost Classifier (Primary)

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `n_estimators` | 300 | Sufficient trees for convergence on this dataset size |
| `max_depth` | 6 | Prevents overfitting while capturing feature interactions |
| `learning_rate` | 0.05 | Conservative learning rate for better generalization |
| `scale_pos_weight` | 77.7 | `42,347 / 545` — compensates for 78:1 class imbalance between Clear and Critical |
| `eval_metric` | mlogloss | Multi-class log-loss for training stability |

**Role**: Learns the decision boundary between Clear, Low Risk, and Critical using the 19 engineered features. Outputs `P(Critical)` — the probability that a container belongs to the Critical class.

### Model 2: Isolation Forest (Anomaly Detector)

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `contamination` | 0.01 | Aligned with the ~1% Critical rate in the data |
| `n_estimators` | 100 | Standard for anomaly detection |
| `max_samples` | auto | Uses min(256, n_samples) per tree |
| `bootstrap` | False | Sampling without replacement for determinism |

**Role**: Identifies containers that are statistically unusual regardless of labels. Catches novel fraud patterns that XGBoost might not have seen in training.

**Training results**: 378 anomalies detected in training (1.00%), 84 in validation (1.04%), with 46 of 82 actual Critical containers flagged as anomalies (56.1% overlap).

### Model 3: Rule-Based Heuristics

A deterministic flag that fires when **any** of these conditions is true:

| Rule | Threshold | Rationale |
|------|-----------|-----------|
| Weight discrepancy > 30% | `weight_diff_pct > 30` | Extreme weight mismatch |
| Severe dwell time | `dwell_flag_120 == 1` | Container held > 120 hours |
| Extreme value-per-kg | `value_per_kg > 99th percentile` | Outlier value density |
| High-risk exporter | `exporter_risk_score > 0.05` | Exporter with > 5% Critical rate |

**Role**: Captures domain-expert knowledge that provides a safety net for cases where ML models might underweight individual extreme signals.

### Ensemble Strategy

The three models are combined into a single risk score:

```
Ensemble_Score = (0.6 × XGBoost_P(Critical) + 0.2 × IsoForest_Norm + 0.2 × Rule_Flag) × 100
```

| Component | Weight | Why |
|-----------|--------|-----|
| **XGBoost** | 60% | Highest individual accuracy; primary discriminator |
| **Isolation Forest** | 20% | Catches statistical outliers that supervised learning may miss |
| **Rule-Based** | 20% | Encodes domain knowledge and provides interpretable safety net |

**Why ensemble?** No single model is perfect. XGBoost excels at learned patterns but can miss novel anomalies. Isolation Forest detects outliers but has no concept of "Critical vs Clear." Rule-based flags capture extreme cases with certainty. The ensemble combines all three perspectives into a more robust score.

---

## 7. Risk Scoring System

### Score Calculation

Every container receives an **Ensemble Score** on a continuous 0–100 scale:

```
Score = (0.6 × P(Critical)_XGBoost + 0.2 × Normalized_IsoScore + 0.2 × Rule_Flag) × 100
```

The Isolation Forest raw score is normalized to [0, 1] using min-max scaling derived from the validation set, ensuring consistent normalization between training and inference:

```
IsoForest_Normalized = 1 − (raw_score − min_score) / (max_score − min_score)
```

### Threshold Optimization

The decision threshold for **Critical** classification was optimized by sweeping thresholds from 20 to 85 and selecting the one that maximizes the F1-score:

| Threshold | F1 Score | Recall | Precision | Critical Predictions |
|-----------|----------|--------|-----------|---------------------|
| 30 | 0.694 | 93.9% | 55.0% | 140 |
| 40 | 0.927 | 92.7% | 92.7% | 82 |
| 50 | 0.926 | 91.5% | 93.8% | 80 |
| **55** | **0.943** | **91.5%** | **97.4%** | **77** |
| 60 | 0.937 | 90.2% | 97.4% | 76 |
| 70 | 0.930 | 89.0% | 97.3% | 75 |

**Best threshold: 55** — achieves the highest F1 (0.943) with excellent precision (97.4%) while maintaining strong recall (91.5%).

### Risk Level Classification

Using the optimized threshold, every container is classified into one of three levels:

```
┌────────────────────────────────────────────────────────────┐
│                    Risk Score Scale                          │
│                                                              │
│   0 ─────────── 30 ────────────── 55 ──────────────── 100  │
│   │    Clear     │    Low Risk    │      Critical      │    │
│   │              │                │                    │    │
│   │  score < 30  │  30 ≤ score    │  score ≥ 55       │    │
│   │              │    < 55        │  (best_threshold)  │    │
└────────────────────────────────────────────────────────────┘
```

| Risk Level | Score Range | Action |
|------------|-------------|--------|
| **Clear** | 0 – 29 | No inspection needed; routine processing |
| **Low Risk** | 30 – 54 | Monitor; may warrant document review |
| **Critical** | 55 – 100 | Priority physical inspection recommended |

### Real-Time Prediction Distribution

When applied to the 8,481 real-time containers:

| Risk Level | Count | Percentage |
|------------|-------|------------|
| **Clear** | 8,287 | 97.7% |
| **Low Risk** | 122 | 1.4% |
| **Critical** | 72 | 0.8% |

This distribution is consistent with the training data (~1% Critical) and demonstrates that the model generalizes well to unseen data.

---

## 8. Explainable AI

### Why Explainability Matters

In regulatory and customs environments, a black-box "this container is risky" flag is insufficient. Officers need to understand **why** a container was flagged to:

- **Prioritize inspections** — a weight discrepancy flag warrants a physical weigh-in, while a value anomaly may need a document audit
- **Justify decisions** — inspections may be challenged by importers; the reasoning must be auditable
- **Build trust** — officers are more likely to act on AI recommendations they understand

### How Explanations Are Generated

The system generates a natural language `Explanation_Summary` for every container by analyzing which features contributed most to the risk score:

```
For each container:
  1. Check weight_diff_pct → "Large weight discrepancy detected (+22%)"
  2. Check value_per_kg    → "Unusual value-to-weight ratio"
  3. Check exporter_risk   → "Exporter historically linked to high-risk shipments"
  4. Check dwell_time      → "Extended dwell time at port (>80 hours)"
  5. Check origin          → "High-risk origin (CN)"
  6. Check hs_chapter_risk → "Commodity category associated with elevated risk"
  7. If no flags triggered → "No significant anomalies detected"
```

### Example Explanations

| Container | Score | Level | Explanation |
|-----------|-------|-------|-------------|
| 91475507 | 99.9 | Critical | Large weight discrepancy detected. Extended dwell time (>120 hrs). High-risk origin (CN). |
| 20889431 | 1.2 | Clear | High-risk origin (TH). |
| 41256141 | 2.5 | Clear | No significant anomalies detected. |

### Top Risk Factors Display

The dashboard presents risk factors visually with directional indicators:

```
+ Weight difference +22%        ← measured vs declared discrepancy
+ Exporter risk score high      ← historical behavioral flag
+ Value per kg anomaly          ← unusual value density
+ Dwell time > 80 hours         ← extended port stay
- Normal HS code risk           ← commodity type is not flagged
```

### Feature Impact Visualization

The `ContainerDetailModal` includes a SHAP-style horizontal bar chart showing each feature's contribution to the risk score, plus a radar chart for the risk profile across dimensions (Weight, Value, Behavior, Temporal, Geographic).

---

## 9. Backend System

The backend is built with **FastAPI** and serves as the bridge between the ML models and the frontend dashboard. Models are loaded once at startup and held in memory for fast inference.

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/health` | Liveness check — confirms API is running and models are loaded |
| `GET` | `/info` | Returns model metadata: version, threshold (55), feature count (19), risk levels, high-risk origins |
| `POST` | `/predict` | Score a **single container** — accepts JSON, returns risk score, level, anomaly flag, and explanation |
| `POST` | `/predict-batch` | Score a **CSV file** of containers (up to 10,000 rows) — returns per-container predictions and summary statistics |
| `GET` | `/containers` | Returns all previously predicted containers with full shipment data merged in |
| `POST` | `/flag-container` | Flag a container for physical inspection — persists to `flagged_containers.json` |
| `GET` | `/flagged-containers` | Returns all flagged containers |
| `POST` | `/container-note` | Add an officer's note to a container — persists to `container_notes.json` |
| `GET` | `/container-notes/{id}` | Returns all notes for a specific container |

### Request / Response Examples

**Single Prediction** (`POST /predict`):

```json
// Request
{
  "Container_ID": 91475507,
  "Declared_Value": 20000,
  "Declared_Weight": 1000,
  "Measured_Weight": 1340,
  "Origin_Country": "CN",
  "Destination_Country": "IN",
  "HS_Code": "854231",
  "Importer_ID": "QLRUBN9",
  "Exporter_ID": "DWNJQL8",
  "Dwell_Time_Hours": 130
}

// Response
{
  "Container_ID": 91475507,
  "Risk_Score": 99.9,
  "Risk_Level": "Critical",
  "Anomaly_Flag": 1,
  "Explanation_Summary": "Large weight discrepancy detected. Extended dwell time. High-risk origin."
}
```

**Batch Prediction** (`POST /predict-batch`):

```json
// Response
{
  "summary": {
    "total_containers": 8481,
    "critical_count": 72,
    "low_risk_count": 122,
    "clear_count": 8287
  },
  "predictions": [
    { "Container_ID": 41256141, "Risk_Score": 2.5, "Risk_Level": "Clear", ... },
    { "Container_ID": 20889431, "Risk_Score": 1.2, "Risk_Level": "Clear", ... }
  ]
}
```

### Backend Architecture

```
backend/
├── main.py                  # FastAPI app, endpoints, CORS, lifespan
├── model_loader.py          # Loads .pkl artifacts, derives calibration constants
├── feature_engineering.py   # Single-record and vectorized batch feature engineering
└── predict_service.py       # Ensemble scoring, risk level assignment, explanation generation
```

### Model Loading at Startup

The `model_loader.py` loads 7 serialized artifacts and derives 3 calibration constants from the training data:

| Artifact | Purpose |
|----------|---------|
| `xgboost_model.pkl` | XGBoost classifier |
| `isolation_forest.pkl` | Isolation Forest anomaly detector |
| `scaler.pkl` | StandardScaler fitted on training features |
| `label_encoder.pkl` | Encodes Clear=0, Critical=1, Low Risk=2 |
| `feature_columns.pkl` | Ordered list of 19 feature names |
| `best_threshold.pkl` | Optimized threshold = 55 |
| `risk_mappings.pkl` | Exporter risk, importer risk, HS chapter risk dictionaries |

**Derived at startup** (not stored in .pkl):
- `iso_score_min`, `iso_score_max` — computed from `iso_forest.score_samples()` on the validation set, ensuring consistent Isolation Forest normalization
- `value_99th`, `value_per_kg_99th` — 99th percentile thresholds from `Historical_Data.csv` for the `is_extreme_value` feature and rule flags

---

## 10. Frontend Dashboard

The dashboard is a modern single-page application built with **React 19**, **TypeScript**, **Tailwind CSS**, and **Recharts**. It uses **Zustand** for global state management and communicates with the FastAPI backend via REST API.

### Pages

| Page | Purpose |
|------|---------|
| **Overview** | KPI cards, risk timeline, donut chart, containers table, live monitoring toggle, risk alert feed |
| **Containers** | Searchable and filterable container list with detail modals |
| **Analytics** | Risk heatmap, anomaly patterns, entity risk analysis, trend charts |
| **Inspection Queue** | Table of flagged containers with status tracking |
| **Reports** | Exportable insights and summary reports |
| **Settings** | Configuration panel |

### Key Components

| Component | Description |
|-----------|-------------|
| **KPICards** | Total containers, critical count, anomaly rate, average risk score — updates reactively |
| **RiskDonutChart** | Donut chart showing Critical / Low Risk / Clear distribution |
| **RiskTimeline** | Area chart tracking risk levels over time |
| **ContainersTable** | Sortable, filterable table with inline AI explanations and risk badges |
| **ContainerDetailModal** | 4-tab modal: AI Explanation, Feature Analysis, Shipment Details, Notes & Actions |
| **RiskHeatmap** | World map colored by country-level risk using `react-simple-maps` |
| **CSVUploader** | Drag-and-drop CSV upload with loading states |
| **LiveMonitorToggle** | Start/stop real-time simulation with live status display |
| **RiskAlertFeed** | Scrollable feed of critical risk alerts with dismiss actions |
| **EntityPanel** | Top risky exporters and importers with shipment counts |
| **AnomalySection** | Anomaly pattern breakdown with statistics |

### Container Detail Modal

The modal is the primary tool for officers reviewing a specific container. It has four tabs:

**Tab 1 — AI Explanation (Default)**
- Risk score gauge (arc visualization with Clear/Low Risk/Critical zones)
- AI explanation summary in natural language
- Top risk factors with directional indicators
- Quick metrics: Weight Δ, Dwell Time, Declared Value, HS Chapter

**Tab 2 — Feature Analysis**
- SHAP-style horizontal bar chart showing each feature's impact
- Radar chart for multi-dimensional risk profile
- Detected risk signals list

**Tab 3 — Shipment Details**
- Full declaration data: Container ID, dates, origin/destination, ports, HS code, importer/exporter, value, weights

**Tab 4 — Notes & Actions**
- **Flag for Inspection** button (persists to backend)
- **Export Report** (copies summary to clipboard)
- **Request Verification** action
- Note input field with save functionality
- Chronological list of all saved notes with timestamps

### Frontend Architecture

```
frontend/src/
├── components/
│   ├── features/          # Domain-specific components (charts, tables, modals)
│   ├── layout/            # Header, Sidebar, Layout shell
│   └── ui/                # Primitive UI components (ShadCN / Radix UI)
├── hooks/                 # Custom React hooks
├── lib/                   # Utility functions (cn, formatNumber, RISK_COLORS)
├── pages/                 # Route pages (Overview, Containers, Analytics, etc.)
├── services/              # API client + real-time simulation engine
├── store/                 # Zustand global state management
├── types/                 # TypeScript interfaces
├── App.tsx                # Route configuration + providers
├── main.tsx               # Entry point
└── index.css              # Tailwind CSS imports
```

---

## 11. Inspection Workflow

The system provides a complete digital workflow for customs inspection management:

```
┌──────────────────────────────────────────────────────────────┐
│                   INSPECTION WORKFLOW                          │
│                                                                │
│   1. Container arrives in the system (CSV upload or live)     │
│                         ↓                                      │
│   2. AI scores the container (ensemble model)                 │
│                         ↓                                      │
│   3. Risk Level assigned: Critical / Low Risk / Clear         │
│                         ↓                                      │
│   4. Officer reviews container in dashboard                   │
│      • Views AI explanation and risk factors                  │
│      • Examines feature analysis charts                       │
│      • Reviews shipment details                               │
│                         ↓                                      │
│   5. Officer flags container for inspection (if needed)       │
│      • Flag is persisted to backend                           │
│      • Container appears in Inspection Queue                  │
│                         ↓                                      │
│   6. Officer adds notes and records actions                   │
│      • Notes are timestamped and saved                        │
│      • Audit trail is maintained                              │
│                         ↓                                      │
│   7. Inspection Queue tracks all flagged containers           │
│      • Status: Flagged → Inspected                            │
│      • Risk score, timestamp, notes visible at a glance       │
└──────────────────────────────────────────────────────────────┘
```

### Inspection Queue Page

The Inspection Queue provides a centralized view of all flagged containers:

| Column | Description |
|--------|-------------|
| Container ID | Unique identifier |
| Risk Score | Color-coded badge (red ≥70, orange ≥30, green <30) |
| Timestamp | When the container was flagged |
| Note | Officer's reason for flagging |
| Status | Flagged (orange) or Inspected (green) |
| Actions | View button to open the full container detail modal |

Summary cards show: **Total Flagged**, **Critical Risk** (flagged with score ≥55), and **Pending Review**.

---

## 12. Real-Time Monitoring

The dashboard includes a **Live Monitoring Mode** that simulates how customs authorities would monitor container flow at an active port in real time.

### How It Works

```
┌─────────────────────────────────────────────────────────┐
│                LIVE MONITORING FLOW                       │
│                                                           │
│   Every 3 seconds:                                       │
│                                                           │
│   1. Simulation engine generates a random container      │
│      (realistic origin, weight, value, HS code, etc.)    │
│                                                           │
│   2. Container sent to POST /predict API                 │
│                                                           │
│   3. AI returns risk score, level, and explanation       │
│                                                           │
│   4. Container inserted into dashboard table (live)      │
│                                                           │
│   5. If Critical → red alert toast + alert feed entry    │
│      If Low Risk > 55 → warning toast                    │
│                                                           │
│   Officers see containers appearing in real time         │
│   with instant AI risk assessments                       │
└─────────────────────────────────────────────────────────┘
```

### Simulation Parameters

The simulation generates realistic container data by randomly selecting from:

- **Origins**: RO, TH, CN, US, DE, JP, KR, VN, IN, BR, and more
- **Destinations**: CR, RS, US, DE, FR, GB, CA, AU, and more
- **HS Codes**: Spanning chapters 42, 69, 62, 85, 95, 84, 90, 72, 61, 87, 29, 30, 38
- **Weights**: 0.5 – 50,000 kg with realistic measured vs declared discrepancies
- **Values**: Wide range reflecting diverse commodity types
- **Dwell Times**: 1 – 200 hours

### User Controls

| Control | Function |
|---------|----------|
| **Toggle Switch** | Start/stop real-time simulation |
| **Status Indicator** | Shows "Live" (green) or "Stopped" (gray) |
| **Container Count** | Number of containers processed in current session |
| **Alert Feed** | Scrollable list of critical risk alerts with dismiss action |

---

## 13. Dashboard Analytics

The Analytics page provides visualizations that help customs authorities understand risk patterns at a strategic level.

### Visualizations

| Visualization | Library | Purpose |
|---------------|---------|---------|
| **Global Risk Heatmap** | react-simple-maps | World map colored by country-level risk — darker red = higher average risk score. Hover tooltip shows country name, total containers, critical count, and risk rate |
| **Risk Timeline** | Recharts (AreaChart) | Time-series chart showing Critical, Low Risk, and Clear container counts over time |
| **Anomaly Patterns** | Recharts | Breakdown of anomaly types (weight discrepancy, value anomaly, dwell time, behavioral) with counts and average risk scores |
| **Entity Risk Panel** | Custom | Top risky exporters and importers ranked by risk score, showing critical shipment counts and total volumes |
| **Risk Distribution Donut** | Recharts (PieChart) | Proportional breakdown of Critical / Low Risk / Clear |

### Analytics Insights

These visualizations answer key strategic questions:

- **Where is risk concentrated?** → The heatmap reveals which trade corridors need more scrutiny
- **Who are the repeat offenders?** → The entity panel identifies high-risk exporters and importers
- **What types of anomalies dominate?** → The anomaly section shows whether weight fraud, value misrepresentation, or behavioral patterns are most prevalent
- **Are risk patterns changing over time?** → The timeline reveals trends and seasonal patterns

---

## 14. Deployment Architecture

### Current Development Setup

```
┌──────────────────────┐        ┌──────────────────────┐
│   Frontend (Vite)    │  HTTP  │   Backend (Uvicorn)  │
│   localhost:5173     │ ────── │   localhost:8000     │
│                      │  CORS  │                      │
│   React 19 + TS      │        │   FastAPI + ML       │
└──────────────────────┘        └──────────────────────┘
```

### Production Deployment Options

| Component | Platform | Configuration |
|-----------|----------|---------------|
| **Frontend** | Vercel / Netlify | Static build (`npm run build` → `dist/`), environment variable for API URL |
| **Backend** | Render / Railway / AWS EC2 | `uvicorn main:app --host 0.0.0.0 --port 8000`, models loaded from attached storage |
| **ML Models** | Bundled with backend | `.pkl` files served from the same container/instance as FastAPI |

### Production Readiness Checklist

- [x] CORS configured for cross-origin frontend-backend communication
- [x] Pydantic validation on all API inputs
- [x] Error handling with proper HTTP status codes
- [x] Batch processing optimized for up to 10,000 containers
- [x] Vectorized feature engineering for performance
- [x] Model artifacts loaded once at startup (not per-request)
- [x] Persistent storage for flags and notes (JSON files; swappable to database)
- [x] TypeScript strict mode for frontend type safety
- [x] Zustand state management with selective persistence
- [x] Production build tested (zero type errors, clean Vite build)

---

## 15. Key Achievements

| Metric | Value |
|--------|-------|
| **Validation Accuracy** | ~99% |
| **Critical Class Recall** | 91.5% — catches 9 out of 10 truly risky containers |
| **Critical Class Precision** | 97.4% — when it says Critical, it's almost always right |
| **Critical F1-Score** | 0.943 — optimal balance of precision and recall |
| **Engineered Features** | 19 features from raw shipment data |
| **Ensemble Model** | 3-model weighted combination (XGBoost + Isolation Forest + Rules) |
| **Threshold Optimization** | Automated F1 sweep across 14 thresholds (20–85) |
| **Batch Processing** | 8,481 containers scored in ~6 seconds |
| **API Endpoints** | 9 REST endpoints covering prediction, inspection, and workflow |
| **Dashboard Pages** | 6 pages (Overview, Containers, Analytics, Inspection Queue, Reports, Settings) |
| **Explainability** | Per-container natural language explanations and feature impact charts |
| **Real-Time Simulation** | Live monitoring mode with 3-second container ingestion |

### Model Performance Summary (Validation Set, 8,101 samples)

| Class | Precision | Recall | F1-Score | Support |
|-------|-----------|--------|----------|---------|
| **Clear** | 0.99 | 1.00 | 1.00 | 6,353 |
| **Critical** | 0.96 | 0.93 | 0.94 | 82 |
| **Low Risk** | 1.00 | 0.98 | 0.99 | 1,666 |
| **Macro Avg** | 0.98 | 0.97 | 0.98 | 8,101 |
| **Weighted Avg** | 0.99 | 0.99 | 0.99 | 8,101 |

---

## 16. Future Improvements

| Improvement | Description |
|-------------|-------------|
| **Database Integration** | Replace JSON/CSV file storage with PostgreSQL for scalability and concurrent access |
| **Customs Database APIs** | Integrate with live customs declaration systems (ASYCUDA, SWIFT) for real data feeds |
| **Advanced Anomaly Detection** | Autoencoders or variational methods for more sophisticated outlier detection |
| **Graph-Based Network Analysis** | Model the exporter-importer-commodity graph to detect trade network anomalies and shell company patterns |
| **SHAP Feature Importance** | Replace rule-based explanations with true SHAP values for model-faithful feature attribution |
| **User Authentication** | Add role-based access control (officers, supervisors, administrators) |
| **Audit Logging** | Track all inspection decisions and system interactions for compliance |
| **Model Retraining Pipeline** | Automated retraining when new labeled data becomes available, with drift detection |
| **Multi-Language Support** | Localize the dashboard for international customs agencies |
| **Mobile Responsive** | Optimize the dashboard for tablet use in port inspection areas |

---

## 17. Conclusion

The **SmartContainer Risk Engine** demonstrates that AI/ML can fundamentally transform how customs authorities assess container risk. By combining supervised learning (XGBoost), unsupervised anomaly detection (Isolation Forest), and domain-expert rules into a weighted ensemble, the system achieves **91.5% recall on Critical containers with 97.4% precision** — meaning it catches the vast majority of truly risky shipments while generating very few false alarms.

### Impact Summary

| Area | Before | After |
|------|--------|-------|
| **Inspection Targeting** | Random or static rules | AI-prioritized risk ranking |
| **Critical Detection** | Unknown hit rate | 91.5% of Critical containers caught |
| **False Positives** | High (broad rules flag too many) | 2.6% false positive rate on Critical |
| **Decision Transparency** | "Flagged" with no reason | Natural language explanation per container |
| **Workflow** | Paper-based, fragmented | Digital queue with notes, flags, and audit trail |
| **Monitoring** | Batch processing | Real-time container scoring as they arrive |

The system is designed to be **practical and deployable**: the FastAPI backend can be containerized and scaled, the React dashboard is production-ready, and the ML models are serialized for fast startup. Whether processing 100 containers or 10,000 in a single batch, the system delivers consistent, explainable, and actionable risk assessments.

For customs authorities, this means **fewer unnecessary inspections, faster processing of legitimate trade, and a significantly higher probability of catching the containers that actually matter**.

---

<div align="center">

**Built for HackA MINed 2026**

*SmartContainer Risk Engine — Making Global Trade Safer with AI*

</div>
