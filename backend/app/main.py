import logging
from pathlib import Path
from contextlib import asynccontextmanager

import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import database as db
from app.api.routes.prediction import router as prediction_router
from app.core.config import settings
from app.models.model_loader import load_models
from app.services.predict_service import predict_batch

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)


def _seed_from_default_realtime_csv(app: FastAPI) -> None:
    """
    Seed the containers table once from the repository's Real-Time Data CSV.
    This gives first-time users immediate data without requiring a manual upload.
    """
    if db.count_containers() > 0:
        logger.info("Containers already present in DB; skipping default CSV seed")
        return

    project_root = Path(__file__).resolve().parents[2]
    csv_candidates = [
        project_root / "data" / "Real-Time Data.csv",
        project_root / "data" / "raw" / "Real_Time_Data.csv",
    ]
    csv_path = next((p for p in csv_candidates if p.exists()), None)

    if csv_path is None:
        logger.warning("Default realtime CSV not found; skipping initial seed")
        return

    try:
        df = pd.read_csv(csv_path)
        result = predict_batch(df, app.state.model_bundle)
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
        logger.info(
            "Seeded %d containers from %s",
            result.total,
            csv_path.name,
        )
    except Exception:
        logger.exception("Failed to seed containers from default realtime CSV")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database")
    db.init_db()

    logger.info("Loading model bundle once at startup")
    app.state.model_bundle = load_models()

    logger.info("Ensuring initial container data is loaded")
    _seed_from_default_realtime_csv(app)

    logger.info("Startup complete")

    yield

    app.state.model_bundle = None
    logger.info("Shutdown complete")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(prediction_router)
