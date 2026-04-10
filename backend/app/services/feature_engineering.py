"""
Feature Engineering — SmartContainer Risk Engine

Contains both single-record and vectorized-batch replicas of
src/02_feature_engineering.py.

• engineer_features()       — single-record (used by POST /predict)
• engineer_features_batch() — DataFrame-level  (used by POST /predict-batch)
"""

import numpy as np
import pandas as pd
from datetime import datetime, timezone
from dataclasses import dataclass

# HS chapters classified as high-risk in the training pipeline
HIGH_RISK_ORIGINS = frozenset({"CN", "TH", "KR", "VN"})


# ---------------------------------------------------------------------------
# Output containers
# ---------------------------------------------------------------------------
@dataclass
class EngineeredFeatures:
    """The 19 model features ordered to match feature_columns.pkl."""
    weight_diff_pct:          float
    weight_underreported:     int
    weight_overreported:      int
    value_per_kg:             float
    log_value:                float
    is_extreme_value:         int
    dwell_flag_80:            int
    dwell_flag_120:           int
    hs_chapter:               int
    hs_chapter_risk:          float
    hour:                     int
    is_weekend:               int
    is_off_hours:             int
    month:                    int
    is_high_risk_origin:      int
    exporter_risk_score:      float
    importer_risk_score:      float
    weight_value_interaction: float
    risk_origin_dwell:        int

    def as_ordered_list(self, feature_columns: list) -> list:
        """Return feature values in the exact order of feature_columns.pkl."""
        mapping = {
            "weight_diff_pct":          self.weight_diff_pct,
            "weight_underreported":     self.weight_underreported,
            "weight_overreported":      self.weight_overreported,
            "value_per_kg":             self.value_per_kg,
            "log_value":                self.log_value,
            "is_extreme_value":         self.is_extreme_value,
            "dwell_flag_80":            self.dwell_flag_80,
            "dwell_flag_120":           self.dwell_flag_120,
            "hs_chapter":               self.hs_chapter,
            "hs_chapter_risk":          self.hs_chapter_risk,
            "hour":                     self.hour,
            "is_weekend":               self.is_weekend,
            "is_off_hours":             self.is_off_hours,
            "month":                    self.month,
            "is_high_risk_origin":      self.is_high_risk_origin,
            "exporter_risk_score":      self.exporter_risk_score,
            "importer_risk_score":      self.importer_risk_score,
            "weight_value_interaction": self.weight_value_interaction,
            "risk_origin_dwell":        self.risk_origin_dwell,
        }
        return [mapping[col] for col in feature_columns]


@dataclass
class RawContext:
    """Non-model fields forwarded to the explanation generator."""
    weight_diff_pct:     float
    value_per_kg:        float
    dwell_flag_80:       int
    dwell_flag_120:      int
    is_high_risk_origin: int
    origin_country:      str
    exporter_risk_score: float
    is_extreme_value:    int
    hs_chapter_risk:     float
    hs_chapter:          int


# ---------------------------------------------------------------------------
# Core function
# ---------------------------------------------------------------------------
def engineer_features(
    declared_value:    float,
    declared_weight:   float,
    measured_weight:   float,
    origin_country:    str,
    hs_code:           str,
    importer_id:       str,
    exporter_id:       str,
    risk_mappings:     dict,
    value_99th:        float,
    dwell_time_hours:  float = 0.0,
    declaration_dt:    datetime | None = None,
) -> tuple[EngineeredFeatures, RawContext]:
    """
    Replicates src/02_feature_engineering.py for a single container record.

    Returns
    -------
    features : EngineeredFeatures
        The 19 model features (unscaled).
    context : RawContext
        Extra fields used by the explanation generator only.
    """
    if declaration_dt is None:
        declaration_dt = datetime.now(timezone.utc)

    # ------------------------------------------------------------------
    # 1. Weight discrepancy
    # ------------------------------------------------------------------
    weight_diff          = measured_weight - declared_weight
    weight_diff_pct      = weight_diff / (declared_weight + 0.001)
    weight_underreported = int(measured_weight > declared_weight * 1.2)
    weight_overreported  = int(declared_weight > measured_weight * 1.2)

    # ------------------------------------------------------------------
    # 2. Value ratios
    # ------------------------------------------------------------------
    value_per_kg = declared_value / (declared_weight + 0.001)
    log_value    = float(np.log1p(declared_value))

    # ------------------------------------------------------------------
    # 3. Dwell time flags
    # ------------------------------------------------------------------
    dwell_flag_80  = int(dwell_time_hours > 80)
    dwell_flag_120 = int(dwell_time_hours > 120)

    # ------------------------------------------------------------------
    # 4. HS Code features
    # ------------------------------------------------------------------
    hs_str     = str(hs_code).zfill(10)
    hs_chapter = int(hs_str[:2])

    # ------------------------------------------------------------------
    # 5. Time features
    # ------------------------------------------------------------------
    hour         = declaration_dt.hour
    day_of_week  = declaration_dt.weekday()          # 0 = Monday … 6 = Sunday
    month        = declaration_dt.month
    is_weekend   = int(day_of_week >= 5)
    is_off_hours = int(hour < 6 or hour > 22)

    # ------------------------------------------------------------------
    # 6. Geographic risk
    # ------------------------------------------------------------------
    is_high_risk_origin = int(origin_country.upper() in HIGH_RISK_ORIGINS)

    # ------------------------------------------------------------------
    # 7. Value outlier flag  (threshold fixed from training distribution)
    # ------------------------------------------------------------------
    is_extreme_value = int(declared_value > value_99th)

    # ------------------------------------------------------------------
    # 8. Behavioral encoding  (lookup tables from risk_mappings.pkl)
    # ------------------------------------------------------------------
    exp_risk_map = risk_mappings.get("exporter_risk", {})
    imp_risk_map = risk_mappings.get("importer_risk", {})
    hs_risk_map  = risk_mappings.get("hs_chapter_risk", {})

    exporter_risk_score = float(exp_risk_map.get(exporter_id, 0.0))
    importer_risk_score = float(imp_risk_map.get(importer_id, 0.0))
    hs_chapter_risk     = float(hs_risk_map.get(hs_chapter, 0.0))

    # ------------------------------------------------------------------
    # 9. Interaction features
    # ------------------------------------------------------------------
    weight_value_interaction = weight_diff_pct * value_per_kg
    risk_origin_dwell        = is_high_risk_origin * dwell_flag_80

    features = EngineeredFeatures(
        weight_diff_pct          = weight_diff_pct,
        weight_underreported     = weight_underreported,
        weight_overreported      = weight_overreported,
        value_per_kg             = value_per_kg,
        log_value                = log_value,
        is_extreme_value         = is_extreme_value,
        dwell_flag_80            = dwell_flag_80,
        dwell_flag_120           = dwell_flag_120,
        hs_chapter               = hs_chapter,
        hs_chapter_risk          = hs_chapter_risk,
        hour                     = hour,
        is_weekend               = is_weekend,
        is_off_hours             = is_off_hours,
        month                    = month,
        is_high_risk_origin      = is_high_risk_origin,
        exporter_risk_score      = exporter_risk_score,
        importer_risk_score      = importer_risk_score,
        weight_value_interaction = weight_value_interaction,
        risk_origin_dwell        = risk_origin_dwell,
    )

    context = RawContext(
        weight_diff_pct     = weight_diff_pct,
        value_per_kg        = value_per_kg,
        dwell_flag_80       = dwell_flag_80,
        dwell_flag_120      = dwell_flag_120,
        is_high_risk_origin = is_high_risk_origin,
        origin_country      = origin_country,
        exporter_risk_score = exporter_risk_score,
        is_extreme_value    = is_extreme_value,
        hs_chapter_risk     = hs_chapter_risk,
        hs_chapter          = hs_chapter,
    )

    return features, context


# ---------------------------------------------------------------------------
# Vectorized batch pipeline  (mirrors src/02_feature_engineering.py exactly)
# ---------------------------------------------------------------------------
_REQUIRED_COLUMNS = {
    "Container_ID", "Declared_Value", "Declared_Weight",
    "Measured_Weight", "Origin_Country", "HS_Code",
    "Importer_ID", "Exporter_ID",
}


def _validate_csv_columns(df: pd.DataFrame) -> list[str]:
    """Return list of missing required columns, or empty list if valid."""
    return sorted(_REQUIRED_COLUMNS - set(df.columns))


def engineer_features_batch(
    df: pd.DataFrame,
    risk_mappings: dict,
    value_99th: float,
) -> pd.DataFrame:
    """
    Vectorized feature engineering on a full DataFrame.

    Mirrors the exact arithmetic from src/02_feature_engineering.py
    while using the pre-computed training-set thresholds for:
      • is_extreme_value  (value_99th from training)
      • behavioral risk encodings  (risk_mappings.pkl)

    Returns the DataFrame with all 19 model features + context columns
    needed for explanation generation attached.
    """
    df = df.copy()

    missing = _validate_csv_columns(df)
    if missing:
        raise ValueError(f"CSV is missing required columns: {missing}")

    if "Dwell_Time_Hours" not in df.columns:
        df["Dwell_Time_Hours"] = 0.0

    # ── 1. Weight discrepancy ─────────────────────────────────────────────
    df["weight_diff"]     = df["Measured_Weight"] - df["Declared_Weight"]
    df["weight_diff_pct"] = (
        (df["Measured_Weight"] - df["Declared_Weight"]) / (df["Declared_Weight"] + 0.001)
    )
    df["weight_underreported"] = (
        df["Measured_Weight"] > df["Declared_Weight"] * 1.2
    ).astype(int)
    df["weight_overreported"] = (
        df["Declared_Weight"] > df["Measured_Weight"] * 1.2
    ).astype(int)

    # ── 2. Value ratios ───────────────────────────────────────────────────
    df["value_per_kg"] = df["Declared_Value"] / (df["Declared_Weight"] + 0.001)
    df["log_value"]    = np.log1p(df["Declared_Value"])

    # ── 3. Dwell time flags ───────────────────────────────────────────────
    df["dwell_flag_80"]  = (df["Dwell_Time_Hours"] > 80).astype(int)
    df["dwell_flag_120"] = (df["Dwell_Time_Hours"] > 120).astype(int)

    # ── 4. HS Code features ───────────────────────────────────────────────
    df["hs_code"]    = df["HS_Code"].astype(str).str.zfill(10)
    df["hs_chapter"] = df["hs_code"].str[:2].astype(int)

    # ── 5. Time features ──────────────────────────────────────────────────
    has_date = "Declaration_Date (YYYY-MM-DD)" in df.columns
    has_time = "Declaration_Time" in df.columns

    if has_date and has_time:
        df["declaration_datetime"] = pd.to_datetime(
            df["Declaration_Date (YYYY-MM-DD)"] + " " + df["Declaration_Time"],
            errors="coerce",
        )
    elif has_date:
        df["declaration_datetime"] = pd.to_datetime(
            df["Declaration_Date (YYYY-MM-DD)"], errors="coerce"
        )
    else:
        df["declaration_datetime"] = pd.Timestamp.now(tz="UTC")

    df["declaration_datetime"] = df["declaration_datetime"].fillna(
        pd.Timestamp.now(tz="UTC")
    )
    df["hour"]        = df["declaration_datetime"].dt.hour
    df["day_of_week"] = df["declaration_datetime"].dt.dayofweek
    df["month"]       = df["declaration_datetime"].dt.month
    df["is_weekend"]  = (df["day_of_week"] >= 5).astype(int)
    df["is_off_hours"] = ((df["hour"] < 6) | (df["hour"] > 22)).astype(int)

    # ── 6. Geographic risk ────────────────────────────────────────────────
    df["is_high_risk_origin"] = (
        df["Origin_Country"].str.upper().isin(HIGH_RISK_ORIGINS).astype(int)
    )

    # ── 7. Value outlier (training-set 99th percentile) ───────────────────
    df["is_extreme_value"] = (df["Declared_Value"] > value_99th).astype(int)

    # ── 8. Behavioral encoding ────────────────────────────────────────────
    exp_map = risk_mappings.get("exporter_risk", {})
    imp_map = risk_mappings.get("importer_risk", {})
    hs_map  = risk_mappings.get("hs_chapter_risk", {})

    df["exporter_risk_score"] = df["Exporter_ID"].map(exp_map).fillna(0.0)
    df["importer_risk_score"] = df["Importer_ID"].map(imp_map).fillna(0.0)
    df["hs_chapter_risk"]     = df["hs_chapter"].map(hs_map).fillna(0.0)

    # ── 9. Interaction features ───────────────────────────────────────────
    df["weight_value_interaction"] = df["weight_diff_pct"] * df["value_per_kg"]
    df["risk_origin_dwell"]        = df["is_high_risk_origin"] * df["dwell_flag_80"]

    return df
