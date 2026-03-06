"""
Database layer — SmartContainer Risk Engine
============================================

SQLite-backed persistence for three tables:

  containers          — prediction results (risk scores, levels, anomaly flags)
  flagged_containers  — inspection queue    (replaces flagged_containers.json)
  container_notes     — analyst notes       (replaces container_notes.json)

The database file (database.db) is created automatically at the project root
the first time init_db() is called.

Usage:
    import database as db
    db.init_db()                          # call once at startup
    db.upsert_container(...)
    db.insert_flagged(...)
    db.insert_note(...)
"""

import logging
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Generator

logger = logging.getLogger(__name__)

# database.db lives at the project root (one level above backend/)
DB_PATH = Path(__file__).resolve().parent.parent / "database.db"


# ---------------------------------------------------------------------------
# Connection helpers
# ---------------------------------------------------------------------------

def _connect() -> sqlite3.Connection:
    """Open a raw connection with Row factory enabled."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    # WAL mode allows concurrent reads while a write is in progress
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def _db() -> Generator[sqlite3.Connection, None, None]:
    """Context manager that commits on success and rolls back on any exception."""
    conn = _connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Schema initialisation
# ---------------------------------------------------------------------------

def init_db() -> None:
    """
    Create all tables and indexes if they do not already exist.

    Safe to call multiple times — all statements use IF NOT EXISTS.
    """
    with _db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS containers (
                container_id  TEXT    PRIMARY KEY,
                risk_score    REAL    NOT NULL,
                risk_level    TEXT    NOT NULL,
                anomaly_flag  INTEGER NOT NULL DEFAULT 0,
                explanation   TEXT    DEFAULT '',
                created_at    TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
            );

            CREATE TABLE IF NOT EXISTS flagged_containers (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                container_id  TEXT    NOT NULL UNIQUE,
                risk_score    REAL,
                note          TEXT    DEFAULT '',
                timestamp     TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
            );

            CREATE TABLE IF NOT EXISTS container_notes (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                container_id  TEXT    NOT NULL,
                note          TEXT    NOT NULL,
                created_at    TEXT    DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now'))
            );

            CREATE INDEX IF NOT EXISTS idx_notes_cid
                ON container_notes (container_id);
        """)
    logger.info("Database ready → %s", DB_PATH)


# ---------------------------------------------------------------------------
# containers table
# ---------------------------------------------------------------------------

def upsert_container(
    *,
    container_id: str,
    risk_score: float,
    risk_level: str,
    anomaly_flag: int,
    explanation: str,
    created_at: datetime | None = None,
) -> None:
    """Insert or update a single container prediction record."""
    ts = (created_at or datetime.utcnow()).isoformat()
    with _db() as conn:
        conn.execute(
            """
            INSERT INTO containers
                (container_id, risk_score, risk_level, anomaly_flag, explanation, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(container_id) DO UPDATE SET
                risk_score   = excluded.risk_score,
                risk_level   = excluded.risk_level,
                anomaly_flag = excluded.anomaly_flag,
                explanation  = excluded.explanation,
                created_at   = excluded.created_at
            """,
            (str(container_id), risk_score, risk_level, anomaly_flag, explanation, ts),
        )


def bulk_upsert_containers(rows: list[dict]) -> int:
    """
    Insert or update many container prediction records in a single transaction.

    Each dict must have keys: container_id, risk_score, risk_level,
    anomaly_flag, explanation.  'created_at' (ISO string or datetime) is optional.

    Returns the number of rows processed.
    """
    now_iso = datetime.utcnow().isoformat()
    params = []
    for r in rows:
        ts = r.get("created_at")
        if isinstance(ts, datetime):
            ts = ts.isoformat()
        params.append((
            str(r["container_id"]),
            float(r["risk_score"]),
            str(r["risk_level"]),
            int(r["anomaly_flag"]),
            str(r.get("explanation", "")),
            ts or now_iso,
        ))

    with _db() as conn:
        conn.executemany(
            """
            INSERT INTO containers
                (container_id, risk_score, risk_level, anomaly_flag, explanation, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(container_id) DO UPDATE SET
                risk_score   = excluded.risk_score,
                risk_level   = excluded.risk_level,
                anomaly_flag = excluded.anomaly_flag,
                explanation  = excluded.explanation,
                created_at   = excluded.created_at
            """,
            params,
        )
    return len(params)


def count_containers() -> int:
    """Return the total number of rows in the containers table."""
    conn = _connect()
    try:
        return conn.execute("SELECT COUNT(*) FROM containers").fetchone()[0]
    finally:
        conn.close()


def get_all_containers(limit: int = 10_000) -> list[dict]:
    """Return all container records ordered by risk_score descending."""
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT * FROM containers ORDER BY risk_score DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_container_risk_score(container_id: str) -> float | None:
    """Return the stored risk_score for a container, or None if not found."""
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT risk_score FROM containers WHERE container_id = ?",
            (str(container_id),),
        ).fetchone()
        return float(row["risk_score"]) if row else None
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# flagged_containers table
# ---------------------------------------------------------------------------

def is_flagged(container_id: str) -> bool:
    """Return True if the container is already in the flagged_containers table."""
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT 1 FROM flagged_containers WHERE container_id = ?",
            (str(container_id),),
        ).fetchone()
        return row is not None
    finally:
        conn.close()


def insert_flagged(
    *,
    container_id: str,
    risk_score: float | None,
    note: str,
    timestamp: datetime,
) -> dict:
    """
    Flag a container for inspection.

    Raises sqlite3.IntegrityError (UNIQUE constraint) if already flagged —
    callers should catch this and return HTTP 409.
    """
    ts_iso = timestamp.isoformat()
    with _db() as conn:
        conn.execute(
            """
            INSERT INTO flagged_containers (container_id, risk_score, note, timestamp)
            VALUES (?, ?, ?, ?)
            """,
            (str(container_id), risk_score, note, ts_iso),
        )
    return {
        "container_id": str(container_id),
        "risk_score": risk_score,
        "note": note,
        "timestamp": ts_iso,
        "status": "flagged",
    }


def get_all_flagged(limit: int = 1_000) -> list[dict]:
    """Return all flagged containers ordered by timestamp descending."""
    conn = _connect()
    try:
        rows = conn.execute(
            """
            SELECT container_id, risk_score, note, timestamp
            FROM flagged_containers
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [
            {**dict(r), "status": "flagged"}
            for r in rows
        ]
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# container_notes table
# ---------------------------------------------------------------------------

def insert_note(
    *,
    container_id: str,
    note: str,
    created_at: datetime,
) -> dict:
    """Persist a new analyst note for a container."""
    ts_iso = created_at.isoformat()
    with _db() as conn:
        conn.execute(
            "INSERT INTO container_notes (container_id, note, created_at) VALUES (?, ?, ?)",
            (str(container_id), note, ts_iso),
        )
    return {
        "container_id": str(container_id),
        "note": note,
        "timestamp": ts_iso,
    }


def get_notes(container_id: str) -> list[dict]:
    """Return all notes for a container ordered by created_at descending."""
    conn = _connect()
    try:
        rows = conn.execute(
            """
            SELECT container_id, note, created_at AS timestamp
            FROM container_notes
            WHERE container_id = ?
            ORDER BY created_at DESC
            """,
            (str(container_id),),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
