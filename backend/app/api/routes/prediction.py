import io
import logging
from datetime import datetime

import pandas as pd
from fastapi import APIRouter, Body, Depends, File, HTTPException, Request, UploadFile

import database as db
from app.dependencies import get_model_bundle
from app.models.model_loader import ModelBundle
from app.schemas.prediction import (
    BatchPredictionResponse,
    BatchPredictionItem,
    BatchSummary,
    ContainerRequest,
    HealthResponse,
    PredictionDetails,
    PredictionResponse,
)
from app.services.predict_service import ContainerInput, PredictionResult, predict, predict_batch

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Prediction"])


@router.get("/health", response_model=HealthResponse, tags=["Operations"])
async def health(request: Request):
    return HealthResponse(
        status="ok",
        models_loaded=getattr(request.app.state, "model_bundle", None) is not None,
    )


@router.post("/predict", response_model=PredictionResponse)
async def predict_single(
    request: ContainerRequest,
    bundle: ModelBundle = Depends(get_model_bundle),
):
    try:
        result: PredictionResult = predict(
            ContainerInput(
                container_id=request.Container_ID,
                declared_value=request.Declared_Value,
                declared_weight=request.Declared_Weight,
                measured_weight=request.Measured_Weight,
                origin_country=request.Origin_Country,
                destination_country=request.Destination_Country,
                hs_code=request.HS_Code,
                importer_id=request.Importer_ID,
                exporter_id=request.Exporter_ID,
                dwell_time_hours=request.Dwell_Time_Hours,
                declaration_dt=request.Declaration_DateTime,
            ),
            bundle,
        )
    except Exception as exc:
        logger.exception("Single prediction failed for container=%s", request.Container_ID)
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc

    db.upsert_container(
        container_id=str(result.container_id),
        risk_score=result.risk_score,
        risk_level=result.risk_level,
        anomaly_flag=result.anomaly_flag,
        explanation=result.explanation_summary,
    )

    return PredictionResponse(
        Container_ID=result.container_id,
        Risk_Score=result.risk_score,
        Risk_Level=result.risk_level,
        Anomaly_Flag=result.anomaly_flag,
        Explanation_Summary=result.explanation_summary,
        details=PredictionDetails(**result.details),
    )


@router.post("/predict-batch", response_model=BatchPredictionResponse)
async def predict_batch_endpoint(
    file: UploadFile = File(...),
    bundle: ModelBundle = Depends(get_model_bundle),
):
    try:
        raw = await file.read()
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid CSV upload: {exc}") from exc

    try:
        result = predict_batch(df, bundle)
    except Exception as exc:
        logger.exception("Batch prediction failed")
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {exc}") from exc

    db.bulk_upsert_containers(
        [
            {
                "container_id": str(item.container_id),
                "risk_score": item.risk_score,
                "risk_level": item.risk_level,
                "anomaly_flag": item.anomaly_flag,
                "explanation": item.explanation_summary,
            }
            for item in result.predictions
        ]
    )

    return BatchPredictionResponse(
        summary=BatchSummary(
            total_containers=result.total,
            critical_count=result.critical_count,
            low_risk_count=result.low_risk_count,
            clear_count=result.clear_count,
        ),
        predictions=[
            BatchPredictionItem(
                Container_ID=item.container_id,
                Risk_Score=item.risk_score,
                Risk_Level=item.risk_level,
                Anomaly_Flag=item.anomaly_flag,
                Explanation_Summary=item.explanation_summary,
            )
            for item in result.predictions
        ],
    )


@router.get("/containers", tags=["Data"])
async def get_containers():
    rows = db.get_all_containers(limit=10000)
    normalized = []
    for r in rows:
        normalized.append(
            {
                "Container_ID": r.get("container_id", ""),
                "Risk_Score": r.get("risk_score", 0),
                "Risk_Level": r.get("risk_level", "Clear"),
                "Anomaly_Flag": r.get("anomaly_flag", 0),
                "Explanation_Summary": r.get("explanation", ""),
                "created_at": r.get("created_at", ""),
            }
        )
    return normalized


@router.post("/flag-container", tags=["Actions"])
async def flag_container(payload: dict = Body(...)):
    container_id = str(payload.get("container_id", "")).strip()
    note = str(payload.get("note", "")).strip()
    if not container_id:
        raise HTTPException(status_code=422, detail="container_id is required")

    if db.is_flagged(container_id):
        raise HTTPException(status_code=409, detail=f"Container {container_id} is already flagged")

    risk_score = db.get_container_risk_score(container_id)
    record = db.insert_flagged(
        container_id=container_id,
        risk_score=risk_score,
        note=note,
        timestamp=datetime.utcnow(),
        status="flagged",
    )
    return record


@router.get("/flagged-containers", tags=["Actions"])
async def get_flagged_containers():
    return db.get_all_flagged()


@router.post("/mark-under-review", tags=["Actions"])
async def mark_under_review(payload: dict = Body(...)):
    container_id = str(payload.get("container_id", "")).strip()
    if not container_id:
        raise HTTPException(status_code=422, detail="container_id is required")

    updated = db.update_flagged_status(container_id, "under_review")
    if not updated:
        raise HTTPException(status_code=404, detail=f"Container {container_id} not found in flagged queue")
    return updated


@router.post("/mark-inspected", tags=["Actions"])
async def mark_inspected(payload: dict = Body(...)):
    container_id = str(payload.get("container_id", "")).strip()
    if not container_id:
        raise HTTPException(status_code=422, detail="container_id is required")

    updated = db.update_flagged_status(container_id, "inspected")
    if not updated:
        raise HTTPException(status_code=404, detail=f"Container {container_id} not found in flagged queue")
    return updated


@router.post("/unflag-container", tags=["Actions"])
async def unflag_container(payload: dict = Body(...)):
    container_id = str(payload.get("container_id", "")).strip()
    if not container_id:
        raise HTTPException(status_code=422, detail="container_id is required")
    removed = db.delete_flagged(container_id)
    return {"container_id": container_id, "removed": removed}


@router.post("/container-note", tags=["Actions"])
async def add_container_note(payload: dict = Body(...)):
    container_id = str(payload.get("container_id", "")).strip()
    note = str(payload.get("note", "")).strip()
    if not container_id or not note:
        raise HTTPException(status_code=422, detail="container_id and note are required")
    return db.insert_note(container_id=container_id, note=note, created_at=datetime.utcnow())


@router.get("/container-notes/{container_id}", tags=["Actions"])
async def get_container_notes(container_id: str):
    return db.get_notes(container_id)


@router.get("/notifications", tags=["Operations"])
async def get_notifications():
    return db.get_notifications(limit=50)


@router.post("/notifications/read", tags=["Operations"])
async def mark_notifications_read():
    count = db.mark_all_notifications_read()
    return {"updated": count}


@router.get("/notifications/unread-count", tags=["Operations"])
async def unread_notification_count():
    return {"count": db.count_unread_notifications()}
