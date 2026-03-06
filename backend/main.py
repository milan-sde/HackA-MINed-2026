"""
SmartContainer Risk Engine — FastAPI Backend
============================================

Start the server:
    cd backend
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

Endpoints:
    POST /predict            — score a single container shipment
    POST /predict-batch      — score a CSV of containers (up to 10k rows)
    GET  /containers         — return cached predictions from data/processed/predictions.csv
    POST /flag-container     — flag a container for inspection
    GET  /flagged-containers — list all flagged containers
    POST /container-note     — attach a note to a container
    GET  /container-notes/{container_id} — get notes for a container
    GET  /health             — liveness check
    GET  /info               — model metadata
"""

import io
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Annotated

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from model_loader import ModelBundle, load_models
from predict_service import (
    ContainerInput,
    PredictionResult,
    predict,
    predict_batch,
)

# ---------------------------------------------------------------------------
# Persistent JSON storage paths
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "processed"
FLAGGED_PATH = Path(__file__).resolve().parent / "flagged_containers.json"
NOTES_PATH = Path(__file__).resolve().parent / "container_notes.json"


def _load_json(path: Path) -> list:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return []
    return []


def _save_json(path: Path, data: list) -> None:
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Application state
# ---------------------------------------------------------------------------
_bundle: ModelBundle | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _bundle
    logger.info("Startup: loading model bundle …")
    _bundle = load_models()
    logger.info("Startup complete — API is ready.")
    yield
    logger.info("Shutdown: releasing resources.")
    _bundle = None


def get_bundle() -> ModelBundle:
    if _bundle is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Models not loaded yet. Please retry in a moment.",
        )
    return _bundle


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="SmartContainer Risk Engine",
    description=(
        "ML-powered customs risk scoring for container shipments.\n\n"
        "Combines XGBoost classification, Isolation Forest anomaly detection, "
        "and rule-based heuristics into a weighted ensemble score."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------
class ContainerRequest(BaseModel):
    Container_ID:         int | str = Field(..., description="Unique container identifier")
    Declared_Value:       float     = Field(..., gt=0,  description="Declared customs value (USD)")
    Declared_Weight:      float     = Field(..., gt=0,  description="Declared weight (kg)")
    Measured_Weight:      float     = Field(..., gt=0,  description="Physically measured weight (kg)")
    Origin_Country:       str       = Field(..., min_length=2, max_length=3, description="ISO-2 origin country code")
    Destination_Country:  str       = Field(..., min_length=2, max_length=3, description="ISO-2 destination country code")
    HS_Code:              str       = Field(..., description="Harmonised System commodity code (4–10 digits)")
    Importer_ID:          str       = Field(..., description="Importer identifier")
    Exporter_ID:          str       = Field(..., description="Exporter identifier")
    Dwell_Time_Hours:     float     = Field(default=0.0, ge=0, description="Hours spent at port (optional, default 0)")
    Declaration_DateTime: datetime | None = Field(
        default=None,
        description="ISO-8601 declaration timestamp (optional, defaults to current UTC time)",
    )

    @field_validator("Origin_Country", "Destination_Country", mode="before")
    @classmethod
    def upper_country(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("HS_Code", mode="before")
    @classmethod
    def clean_hs_code(cls, v: str) -> str:
        cleaned = str(v).strip().replace(" ", "").replace(".", "")
        if not cleaned.isdigit():
            raise ValueError("HS_Code must contain only digits")
        if len(cleaned) > 10:
            raise ValueError("HS_Code must be at most 10 digits")
        return cleaned

    model_config = {
        "json_schema_extra": {
            "example": {
                "Container_ID": 1234,
                "Declared_Value": 20000,
                "Declared_Weight": 1000,
                "Measured_Weight": 1100,
                "Origin_Country": "CN",
                "Destination_Country": "IN",
                "HS_Code": "8542",
                "Importer_ID": "IMP001",
                "Exporter_ID": "EXP123",
            }
        }
    }


class PredictionDetails(BaseModel):
    xgb_probability:      float = Field(description="XGBoost P(Critical)")
    iso_score_normalised: float = Field(description="Isolation Forest normalised anomaly score [0–1]")
    rule_flag:            int   = Field(description="Heuristic rule flag (0 or 1)")
    threshold_used:       float = Field(description="Ensemble score threshold for Critical classification")


class PredictionResponse(BaseModel):
    Container_ID:        int | str
    Risk_Score:          float = Field(description="Ensemble risk score [0–100]")
    Risk_Level:          str   = Field(description="Critical | Low Risk | Clear")
    Anomaly_Flag:        int   = Field(description="1 if anomaly detected, else 0")
    Explanation_Summary: str   = Field(description="Human-readable risk summary")
    details:             PredictionDetails


class HealthResponse(BaseModel):
    status:  str
    models_loaded: bool


class InfoResponse(BaseModel):
    model_version:    str
    best_threshold:   float
    feature_count:    int
    risk_levels:      list[str]
    high_risk_origins: list[str]


# ── Batch schemas ─────────────────────────────────────────────────────────
class BatchPredictionItem(BaseModel):
    Container_ID:        int | str
    Risk_Score:          float
    Risk_Level:          str
    Anomaly_Flag:        int
    Explanation_Summary: str


class BatchSummary(BaseModel):
    total_containers: int
    critical_count:   int
    low_risk_count:   int
    clear_count:      int


class BatchPredictionResponse(BaseModel):
    summary:     BatchSummary
    predictions: list[BatchPredictionItem]


MAX_BATCH_ROWS = 10_000


# ── Flag / Notes schemas ──────────────────────────────────────────────────
class FlagRequest(BaseModel):
    container_id: int | str
    note: str = ""

class FlagResponse(BaseModel):
    container_id: str
    risk_score: float | None = None
    note: str
    timestamp: str
    status: str = "flagged"

class NoteRequest(BaseModel):
    container_id: int | str
    note: str

class NoteResponse(BaseModel):
    container_id: str
    note: str
    timestamp: str

class ContainerRecord(BaseModel):
    model_config = {"extra": "allow"}
    Container_ID: int | str
    Risk_Score: float
    Risk_Level: str
    Anomaly_Flag: int
    Explanation_Summary: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health", response_model=HealthResponse, tags=["Operations"])
async def health():
    """Liveness check — returns 200 when the API is up and models are loaded."""
    return HealthResponse(status="ok", models_loaded=_bundle is not None)


@app.get("/info", response_model=InfoResponse, tags=["Operations"])
async def info():
    """Returns metadata about the loaded model configuration."""
    bundle = get_bundle()
    return InfoResponse(
        model_version     = "1.0.0",
        best_threshold    = bundle.best_threshold,
        feature_count     = len(bundle.feature_columns),
        risk_levels       = ["Clear", "Low Risk", "Critical"],
        high_risk_origins = ["CN", "TH", "KR", "VN"],
    )


@app.post(
    "/predict",
    response_model=PredictionResponse,
    status_code=status.HTTP_200_OK,
    tags=["Prediction"],
    summary="Score a container shipment",
    description=(
        "Accepts raw shipment declaration fields and returns a risk score, "
        "risk level, anomaly flag, and explanation summary."
    ),
)
async def predict_endpoint(request: ContainerRequest):
    """
    Run the SmartContainer Risk Engine on a single shipment.

    - **Risk_Score**: Ensemble score 0–100 (higher = more suspicious)
    - **Risk_Level**: `Critical` / `Low Risk` / `Clear`
    - **Anomaly_Flag**: `1` if Isolation Forest or rule heuristics flag the shipment
    - **Explanation_Summary**: Up to two most prominent risk signals in plain English
    """
    bundle = get_bundle()

    inp = ContainerInput(
        container_id        = request.Container_ID,
        declared_value      = request.Declared_Value,
        declared_weight     = request.Declared_Weight,
        measured_weight     = request.Measured_Weight,
        origin_country      = request.Origin_Country,
        destination_country = request.Destination_Country,
        hs_code             = request.HS_Code,
        importer_id         = request.Importer_ID,
        exporter_id         = request.Exporter_ID,
        dwell_time_hours    = request.Dwell_Time_Hours,
        declaration_dt      = request.Declaration_DateTime,
    )

    try:
        result: PredictionResult = predict(inp, bundle)
    except Exception as exc:
        logger.exception("Prediction failed for Container_ID=%s", request.Container_ID)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction error: {exc}",
        ) from exc

    return PredictionResponse(
        Container_ID        = result.container_id,
        Risk_Score          = result.risk_score,
        Risk_Level          = result.risk_level,
        Anomaly_Flag        = result.anomaly_flag,
        Explanation_Summary = result.explanation_summary,
        details             = PredictionDetails(**result.details),
    )


@app.post(
    "/predict-batch",
    response_model=BatchPredictionResponse,
    status_code=status.HTTP_200_OK,
    tags=["Prediction"],
    summary="Score a batch of containers from CSV",
    description=(
        "Upload a CSV file containing container shipment data. "
        f"Maximum {MAX_BATCH_ROWS:,} rows per request. "
        "Returns per-container predictions and aggregate summary statistics."
    ),
)
async def predict_batch_endpoint(file: UploadFile = File(...)):
    """
    Accepts a CSV file upload and returns risk predictions for every row.

    **Required CSV columns:**
    `Container_ID`, `Declared_Value`, `Declared_Weight`, `Measured_Weight`,
    `Origin_Country`, `HS_Code`, `Importer_ID`, `Exporter_ID`

    **Optional CSV columns:**
    `Dwell_Time_Hours`, `Destination_Country`,
    `Declaration_Date (YYYY-MM-DD)`, `Declaration_Time`
    """
    bundle = get_bundle()

    if file.content_type not in (
        "text/csv",
        "application/vnd.ms-excel",
        "application/octet-stream",
    ):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Expected a CSV file, got content-type '{file.content_type}'.",
        )

    try:
        raw_bytes = await file.read()
        df = pd.read_csv(io.BytesIO(raw_bytes))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV: {exc}",
        ) from exc

    if df.empty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded CSV contains no data rows.",
        )

    if len(df) > MAX_BATCH_ROWS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"CSV contains {len(df):,} rows, which exceeds the "
                f"{MAX_BATCH_ROWS:,}-row limit."
            ),
        )

    try:
        result = predict_batch(df, bundle)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        logger.exception("Batch prediction failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Batch prediction error: {exc}",
        ) from exc

    # Save predictions to disk so GET /containers can serve them later
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    pred_rows = [
        {
            "Container_ID": p.container_id,
            "Risk_Score": round(p.risk_score, 2),
            "Risk_Level": p.risk_level,
            "Anomaly_Flag": p.anomaly_flag,
            "Explanation_Summary": p.explanation_summary,
        }
        for p in result.predictions
    ]
    pd.DataFrame(pred_rows).to_csv(DATA_DIR / "predictions.csv", index=False)
    logger.info("Saved %d predictions to %s", len(pred_rows), DATA_DIR / "predictions.csv")

    # Also save full input+output merged CSV
    merged = df.copy()
    pred_df = pd.DataFrame(pred_rows).set_index("Container_ID")
    merged = merged.set_index("Container_ID").join(pred_df, rsuffix="_pred").reset_index()
    merged.to_csv(DATA_DIR / "full_predictions.csv", index=False)

    return BatchPredictionResponse(
        summary=BatchSummary(
            total_containers = result.total,
            critical_count   = result.critical_count,
            low_risk_count   = result.low_risk_count,
            clear_count      = result.clear_count,
        ),
        predictions=[
            BatchPredictionItem(
                Container_ID        = p.container_id,
                Risk_Score          = p.risk_score,
                Risk_Level          = p.risk_level,
                Anomaly_Flag        = p.anomaly_flag,
                Explanation_Summary = p.explanation_summary,
            )
            for p in result.predictions
        ],
    )


# ---------------------------------------------------------------------------
# GET /containers — serve cached predictions merged with source data
# ---------------------------------------------------------------------------
RAW_DATA_PATHS = [
    DATA_DIR / "full_predictions.csv",
    DATA_DIR.parent.parent / "data" / "processed" / "Historical_Engineered.csv",
    DATA_DIR.parent / "Historical_Data.csv",
]


@app.get(
    "/containers",
    tags=["Data"],
    summary="Get all container predictions with full shipment data",
)
async def get_containers():
    """
    Returns every predicted container as JSON, including raw shipment fields
    (Declared_Weight, Measured_Weight, Origin_Country, etc.) merged from the
    source data file.
    """
    full_path = DATA_DIR / "full_predictions.csv"
    pred_path = DATA_DIR / "predictions.csv"

    # If full_predictions.csv exists (created by /predict-batch), use it directly
    if full_path.exists():
        try:
            df = pd.read_csv(full_path)
            df = df.fillna("")
            return df.to_dict(orient="records")
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to read full predictions: {exc}",
            ) from exc

    if not pred_path.exists():
        return []

    try:
        pred_df = pd.read_csv(pred_path)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read predictions: {exc}",
        ) from exc

    # Try to merge with a raw data source to get full shipment details
    raw_cols = [
        "Container_ID", "Declared_Value", "Declared_Weight", "Measured_Weight",
        "Origin_Country", "Destination_Country", "Destination_Port",
        "HS_Code", "Importer_ID", "Exporter_ID", "Dwell_Time_Hours",
        "Declaration_Date (YYYY-MM-DD)", "Declaration_Time",
        "Trade_Regime (Import / Export / Transit)",
    ]

    for raw_path in RAW_DATA_PATHS:
        if not raw_path.exists():
            continue
        try:
            raw_df = pd.read_csv(raw_path, usecols=lambda c: c in raw_cols)
            merged = pred_df.merge(raw_df, on="Container_ID", how="left")
            # Save for next time so we don't re-merge
            merged.to_csv(full_path, index=False)
            logger.info(
                "Merged predictions with %s (%d rows)", raw_path.name, len(merged)
            )
            merged = merged.fillna("")
            return merged.to_dict(orient="records")
        except Exception:
            continue

    # Fallback: return predictions-only
    pred_df = pred_df.fillna("")
    return pred_df.to_dict(orient="records")


# ---------------------------------------------------------------------------
# POST /flag-container — flag for inspection
# ---------------------------------------------------------------------------
@app.post(
    "/flag-container",
    response_model=FlagResponse,
    tags=["Actions"],
    summary="Flag a container for inspection",
)
async def flag_container(req: FlagRequest):
    flagged = _load_json(FLAGGED_PATH)
    cid = str(req.container_id)

    # Check if already flagged
    for entry in flagged:
        if str(entry.get("container_id")) == cid:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Container {cid} is already flagged for inspection.",
            )

    # Look up risk score from predictions if available
    risk_score: float | None = None
    pred_path = DATA_DIR / "predictions.csv"
    if pred_path.exists():
        try:
            df = pd.read_csv(pred_path)
            match = df[df["Container_ID"].astype(str) == cid]
            if not match.empty:
                risk_score = float(match.iloc[0]["Risk_Score"])
        except Exception:
            pass

    entry = {
        "container_id": cid,
        "risk_score": risk_score,
        "note": req.note,
        "timestamp": datetime.utcnow().isoformat(),
        "status": "flagged",
    }
    flagged.append(entry)
    _save_json(FLAGGED_PATH, flagged)
    logger.info("Container %s flagged for inspection", cid)

    return FlagResponse(**entry)


# ---------------------------------------------------------------------------
# GET /flagged-containers — list inspection queue
# ---------------------------------------------------------------------------
@app.get(
    "/flagged-containers",
    response_model=list[FlagResponse],
    tags=["Actions"],
    summary="Get all flagged containers",
)
async def get_flagged_containers():
    return _load_json(FLAGGED_PATH)


# ---------------------------------------------------------------------------
# POST /container-note — add a note to a container
# ---------------------------------------------------------------------------
@app.post(
    "/container-note",
    response_model=NoteResponse,
    tags=["Actions"],
    summary="Add a note to a container",
)
async def add_container_note(req: NoteRequest):
    if not req.note.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Note cannot be empty.",
        )

    notes = _load_json(NOTES_PATH)
    entry = {
        "container_id": str(req.container_id),
        "note": req.note.strip(),
        "timestamp": datetime.utcnow().isoformat(),
    }
    notes.append(entry)
    _save_json(NOTES_PATH, notes)
    logger.info("Note added for container %s", req.container_id)
    return NoteResponse(**entry)


# ---------------------------------------------------------------------------
# GET /container-notes/{container_id} — get notes for a container
# ---------------------------------------------------------------------------
@app.get(
    "/container-notes/{container_id}",
    response_model=list[NoteResponse],
    tags=["Actions"],
    summary="Get notes for a specific container",
)
async def get_container_notes(container_id: str):
    notes = _load_json(NOTES_PATH)
    return [n for n in notes if str(n.get("container_id")) == container_id]
