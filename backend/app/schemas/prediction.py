from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class ContainerRequest(BaseModel):
    Container_ID: int | str
    Declared_Value: float = Field(..., gt=0)
    Declared_Weight: float = Field(..., gt=0)
    Measured_Weight: float = Field(..., gt=0)
    Origin_Country: str = Field(..., min_length=2, max_length=3)
    Destination_Country: str = Field(..., min_length=2, max_length=3)
    HS_Code: str
    Importer_ID: str
    Exporter_ID: str
    Dwell_Time_Hours: float = Field(default=0.0, ge=0)
    Declaration_DateTime: datetime | None = None

    @field_validator("Origin_Country", "Destination_Country", mode="before")
    @classmethod
    def upper_country(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("HS_Code", mode="before")
    @classmethod
    def clean_hs_code(cls, value: str) -> str:
        cleaned = str(value).strip().replace(" ", "").replace(".", "")
        if not cleaned.isdigit():
            raise ValueError("HS_Code must contain only digits")
        return cleaned


class PredictionDetails(BaseModel):
    xgb_probability: float
    iso_score_normalised: float
    rule_flag: int
    threshold_used: float


class PredictionResponse(BaseModel):
    Container_ID: int | str
    Risk_Score: float
    Risk_Level: str
    Anomaly_Flag: int
    Explanation_Summary: str
    details: PredictionDetails


class BatchPredictionItem(BaseModel):
    Container_ID: int | str
    Risk_Score: float
    Risk_Level: str
    Anomaly_Flag: int
    Explanation_Summary: str


class BatchSummary(BaseModel):
    total_containers: int
    critical_count: int
    low_risk_count: int
    clear_count: int


class BatchPredictionResponse(BaseModel):
    summary: BatchSummary
    predictions: list[BatchPredictionItem]


class HealthResponse(BaseModel):
    status: str
    models_loaded: bool
