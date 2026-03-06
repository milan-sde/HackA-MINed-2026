"""
SmartContainer Risk Engine — FastAPI Backend
============================================

Start the server:
    cd backend
    uvicorn main:app --reload --host 0.0.0.0 --port 8000

Endpoints:
    POST /predict            — score a single container shipment
    POST /predict-batch      — score a CSV of containers (up to 10k rows)
    GET  /containers         — return container predictions from SQLite database
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
import sqlite3
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

import database as db
from model_loader import ModelBundle, load_models
from predict_service import (
    ContainerInput,
    PredictionResult,
    predict,
    predict_batch,
)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "processed"
# Legacy JSON paths — used only during one-time migration at startup
_FLAGGED_JSON = Path(__file__).resolve().parent / "flagged_containers.json"
_NOTES_JSON   = Path(__file__).resolve().parent / "container_notes.json"

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


def _migrate_json_to_db() -> None:
    """
    One-time migration: import any existing flagged_containers.json and
    container_notes.json into the database, then leave the JSON files in
    place as an archive (they are no longer read by the API).
    """
    # --- flagged containers ---
    if _FLAGGED_JSON.exists():
        try:
            records = json.loads(_FLAGGED_JSON.read_text(encoding="utf-8"))
            migrated = 0
            for r in records:
                cid = str(r.get("container_id", ""))
                if not cid:
                    continue
                try:
                    ts_raw = r.get("timestamp", datetime.utcnow().isoformat())
                    ts = datetime.fromisoformat(ts_raw) if isinstance(ts_raw, str) else ts_raw
                    db.insert_flagged(
                        container_id=cid,
                        risk_score=r.get("risk_score"),
                        note=r.get("note", ""),
                        timestamp=ts,
                    )
                    migrated += 1
                except sqlite3.IntegrityError:
                    pass  # already in DB
            if migrated:
                logger.info("Migrated %d flagged container(s) from JSON → DB", migrated)
        except Exception as exc:
            logger.warning("Could not migrate flagged_containers.json: %s", exc)

    # --- container notes ---
    if _NOTES_JSON.exists():
        try:
            records = json.loads(_NOTES_JSON.read_text(encoding="utf-8"))
            migrated = 0
            for r in records:
                cid = str(r.get("container_id", ""))
                note = r.get("note", "").strip()
                if not cid or not note:
                    continue
                try:
                    ts_raw = r.get("timestamp", datetime.utcnow().isoformat())
                    ts = datetime.fromisoformat(ts_raw) if isinstance(ts_raw, str) else ts_raw
                    db.insert_note(container_id=cid, note=note, created_at=ts)
                    migrated += 1
                except Exception:
                    pass
            if migrated:
                logger.info("Migrated %d note(s) from JSON → DB", migrated)
        except Exception as exc:
            logger.warning("Could not migrate container_notes.json: %s", exc)


def _seed_containers_from_csv() -> None:
    """
    Populate the containers table from full_predictions.csv if the table is
    currently empty.  This runs once on startup so the API is immediately
    useful without requiring a fresh /predict-batch call.
    """
    if db.count_containers() > 0:
        return

    full_path = DATA_DIR / "full_predictions.csv"
    if not full_path.exists():
        logger.info("No full_predictions.csv found — containers table starts empty.")
        return

    try:
        df = pd.read_csv(full_path)
        col_map = {
            "Container_ID":        "container_id",
            "Risk_Score":          "risk_score",
            "Risk_Level":          "risk_level",
            "Anomaly_Flag":        "anomaly_flag",
            "Explanation_Summary": "explanation",
        }
        required = set(col_map.keys())
        if not required.issubset(df.columns):
            missing = required - set(df.columns)
            logger.warning("CSV missing columns %s — skipping seed.", missing)
            return

        rows = (
            df[list(col_map.keys())]
            .rename(columns=col_map)
            .fillna({"explanation": "", "anomaly_flag": 0})
            .to_dict(orient="records")
        )
        count = db.bulk_upsert_containers(rows)
        logger.info("Seeded %d container(s) into DB from %s", count, full_path.name)
    except Exception as exc:
        logger.warning("Could not seed containers from CSV: %s", exc)


def _seed_notifications() -> None:
    """Generate real notifications from the container data on startup."""
    # Only seed if there are no notifications yet
    existing = db.get_notifications(limit=1)
    if existing:
        return

    try:
        containers = db.get_all_containers(limit=10_000)
        if not containers:
            return

        # 1. Critical containers alert
        critical = [c for c in containers if c.get("risk_level") == "Critical"]
        if critical:
            high_weight = [c for c in critical if "weight discrepancy" in c.get("explanation", "").lower()]
            msg = f"Weight discrepancy >30% detected" if high_weight else f"Anomaly detection flagged high-risk shipments"
            db.insert_notification(
                title=f"{len(critical)} Critical containers flagged",
                message=msg,
                ntype="critical",
            )

        # 2. High dwell time alerts (pick top one)
        long_dwell = [c for c in containers if "dwell" in c.get("explanation", "").lower()]
        if long_dwell:
            top = long_dwell[0]
            db.insert_notification(
                title="High dwell time alert",
                message=f"{top['container_id']} exceeded 120 hrs",
                ntype="warning",
            )

        # 3. Anomaly detection summary
        anomalies = [c for c in containers if c.get("anomaly_flag")]
        if anomalies:
            db.insert_notification(
                title=f"{len(anomalies)} anomalies detected",
                message="Isolation Forest + rule-based checks flagged suspicious containers",
                ntype="warning",
            )

        # 4. Model loaded notification
        db.insert_notification(
            title="Model loaded successfully",
            message="XGBoost + Isolation Forest ensemble ready",
            ntype="success",
        )

        logger.info("Seeded %d startup notifications", 4 if anomalies else 3)
    except Exception as exc:
        logger.warning("Could not seed notifications: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _bundle
    logger.info("Startup: initialising database …")
    db.init_db()
    _migrate_json_to_db()
    _seed_containers_from_csv()
    _seed_notifications()
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


# ── Notification schemas ──────────────────────────────────────────────────
class NotificationOut(BaseModel):
    id: int
    title: str
    message: str
    type: str
    is_read: bool
    created_at: str

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

    # Persist the result so GET /containers and /flag-container can access it
    db.upsert_container(
        container_id = str(result.container_id),
        risk_score   = result.risk_score,
        risk_level   = result.risk_level,
        anomaly_flag = result.anomaly_flag,
        explanation  = result.explanation_summary,
    )

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

    # ── Persist to database ──────────────────────────────────────────────────
    now = datetime.utcnow()
    db_rows = [
        {
            "container_id": str(p.container_id),
            "risk_score":   round(p.risk_score, 2),
            "risk_level":   p.risk_level,
            "anomaly_flag": p.anomaly_flag,
            "explanation":  p.explanation_summary,
            "created_at":   now,
        }
        for p in result.predictions
    ]
    inserted = db.bulk_upsert_containers(db_rows)
    logger.info("Upserted %d prediction(s) into containers table", inserted)

    # ── Generate notifications for this batch ────────────────────────────────
    crit_count = result.critical_count
    if crit_count > 0:
        db.insert_notification(
            title=f"{crit_count} Critical containers detected",
            message=f"Batch upload flagged {crit_count} high-risk shipments",
            ntype="critical",
        )
    anomaly_count = sum(1 for p in result.predictions if p.anomaly_flag)
    if anomaly_count > 0:
        db.insert_notification(
            title=f"{anomaly_count} anomalies in uploaded batch",
            message="Isolation Forest + rule-based checks triggered",
            ntype="warning",
        )
    db.insert_notification(
        title=f"Batch processed: {result.total} containers",
        message=f"Critical: {crit_count} | Low Risk: {result.low_risk_count} | Clear: {result.clear_count}",
        ntype="success",
    )

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
# GET /containers — serve predictions from the database
# ---------------------------------------------------------------------------

@app.get(
    "/containers",
    tags=["Data"],
    summary="Get all container predictions with full shipment data",
)
async def get_containers():
    """
    Returns every predicted container as JSON.

    Primary source: the **containers** table in SQLite.
    The database records are enriched with extra shipment columns
    (Declared_Weight, Origin_Country, etc.) from full_predictions.csv when
    that file is available, so the frontend receives the full row shape it
    expects.

    Fallback: if the database is empty, full_predictions.csv is returned
    directly (e.g. before the first /predict-batch call post-migration).
    """
    db_rows = db.get_all_containers()

    if db_rows:
        # Normalise column names to match the CSV / frontend convention
        col_rename = {
            "container_id": "Container_ID",
            "risk_score":   "Risk_Score",
            "risk_level":   "Risk_Level",
            "anomaly_flag": "Anomaly_Flag",
            "explanation":  "Explanation_Summary",
            "created_at":   "created_at",
        }
        db_df = pd.DataFrame(db_rows).rename(columns=col_rename)

        # Attempt to enrich with extra shipment columns from full_predictions.csv
        full_path = DATA_DIR / "full_predictions.csv"
        if full_path.exists():
            try:
                csv_df = pd.read_csv(full_path)
                # Only pull in columns that are NOT already in the DB result
                extra_cols = [
                    c for c in csv_df.columns
                    if c not in db_df.columns and c != "Container_ID"
                ]
                if extra_cols and "Container_ID" in csv_df.columns:
                    csv_df["Container_ID"] = csv_df["Container_ID"].astype(str)
                    db_df["Container_ID"]  = db_df["Container_ID"].astype(str)
                    db_df = db_df.merge(
                        csv_df[["Container_ID"] + extra_cols],
                        on="Container_ID",
                        how="left",
                    )
            except Exception as exc:
                logger.warning("Could not enrich DB rows with CSV columns: %s", exc)

        return db_df.fillna("").to_dict(orient="records")

    # ── Fallback: DB is empty — serve the CSV directly ──────────────────────
    full_path = DATA_DIR / "full_predictions.csv"
    if full_path.exists():
        try:
            df = pd.read_csv(full_path).fillna("")
            logger.info("DB empty — serving %d rows from CSV fallback", len(df))
            return df.to_dict(orient="records")
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to read predictions CSV: {exc}",
            ) from exc

    return []


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
    cid = str(req.container_id)

    if db.is_flagged(cid):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Container {cid} is already flagged for inspection.",
        )

    # Look up the stored risk score from the containers table
    risk_score: float | None = db.get_container_risk_score(cid)

    try:
        entry = db.insert_flagged(
            container_id=cid,
            risk_score=risk_score,
            note=req.note,
            timestamp=datetime.utcnow(),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to flag container: {exc}",
        ) from exc

    logger.info("Container %s flagged for inspection", cid)
    db.insert_notification(
        title=f"Container {cid} flagged",
        message=req.note or "Flagged for inspection from dashboard",
        ntype="info",
    )
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
    return db.get_all_flagged()


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
    note_text = req.note.strip()
    if not note_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Note cannot be empty.",
        )

    entry = db.insert_note(
        container_id=str(req.container_id),
        note=note_text,
        created_at=datetime.utcnow(),
    )
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
    return db.get_notes(container_id)


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------
@app.get(
    "/notifications",
    response_model=list[NotificationOut],
    tags=["Notifications"],
    summary="Get recent notifications",
)
async def get_notifications():
    return db.get_notifications()


@app.post(
    "/notifications/read",
    tags=["Notifications"],
    summary="Mark all notifications as read",
)
async def mark_notifications_read():
    count = db.mark_all_notifications_read()
    return {"marked_read": count}


@app.get(
    "/notifications/unread-count",
    tags=["Notifications"],
    summary="Get unread notification count",
)
async def unread_count():
    return {"count": db.count_unread_notifications()}
