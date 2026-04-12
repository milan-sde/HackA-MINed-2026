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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)


def _candidate_roots() -> list[Path]:
    """Return likely project roots across local and Render runtime layouts."""
    file_root = Path(__file__).resolve().parents[2]
    cwd = Path.cwd().resolve()
    roots = [file_root, cwd, cwd.parent, file_root.parent]
    seen: set[str] = set()
    unique: list[Path] = []
    for p in roots:
        key = str(p)
        if key in seen:
            continue
        seen.add(key)
        unique.append(p)
    return unique


def _seed_from_precomputed_predictions() -> bool:
    """Seed from full_predictions.csv when present (fastest startup path)."""
    required = {
        "Container_ID",
        "Risk_Score",
        "Risk_Level",
        "Anomaly_Flag",
        "Explanation_Summary",
    }

    csv_candidates = [
        root / "data" / "processed" / "full_predictions.csv"
        for root in _candidate_roots()
    ]

    csv_path = next((p for p in csv_candidates if p.exists()), None)
    if csv_path is None:
        return False

    try:
        df = pd.read_csv(csv_path)
        missing = required - set(df.columns)
        if missing:
            logger.warning("Precomputed predictions missing columns %s", sorted(missing))
            return False

        db.bulk_upsert_containers(
            [
                {
                    "container_id": str(row["Container_ID"]),
                    "risk_score": float(row["Risk_Score"]),
                    "risk_level": str(row["Risk_Level"]),
                    "anomaly_flag": int(row["Anomaly_Flag"]),
                    "explanation": str(row.get("Explanation_Summary", "")),
                    "raw_data": row.to_dict(),
                }
                for _, row in df.iterrows()
            ]
        )
        logger.info("Seeded %d containers from %s", len(df), csv_path)
        return True
    except Exception:
        logger.exception("Failed to seed from precomputed predictions CSV")
        return False


def _seed_initial_data(app: FastAPI) -> None:
    """Populate DB once on first boot, with robust fallbacks for deployment envs."""
    if db.count_containers() > 0:
        logger.info("Containers already present in DB; skipping initial seed")
        return

    if _seed_from_precomputed_predictions():
        return

    logger.warning("No precomputed predictions found; initial data load skipped")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database")
    db.init_db()

    logger.info("Loading model bundle once at startup")
    app.state.model_bundle = load_models()

    logger.info("Ensuring initial container data is loaded")
    _seed_initial_data(app)

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
