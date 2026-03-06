export type RiskLevel = "Critical" | "Low Risk" | "Clear";

export interface Container {
  id: string;
  riskScore: number;
  riskLevel: RiskLevel;
  anomalyFlag: boolean;
  originCountry: string;
  originFlag: string;
  destinationCountry: string;
  destinationPort: string;
  hsCode: string;
  hsChapter: number;
  declaredValue: number;
  declaredWeight: number;
  measuredWeight: number;
  weightDiscrepancyPct: number;
  dwellTimeHours: number;
  importerId: string;
  exporterId: string;
  declarationDate: string;
  tradeRegime: "Import" | "Export" | "Transit";
  explanation: string;
  keyRiskFactors: string[];
  // Feature scores (0-1)
  featureScores: {
    weightDiscrepancy: number;
    valueRatio: number;
    dwellTime: number;
    routeRisk: number;
    entityHistory: number;
  };
}

export interface KPIData {
  totalContainers: number;
  criticalCount: number;
  criticalPct: number;
  anomalyCount: number;
  anomalyRate: number;
  avgRiskScore: number;
  trend: {
    total: number;
    critical: number;
    anomaly: number;
    avgScore: number;
  };
}

export interface TimelinePoint {
  date: string;
  critical: number;
  lowRisk: number;
  clear: number;
  avgScore: number;
}

export interface AnomalyPattern {
  pattern: string;
  count: number;
  avgRisk: number;
  description: string;
}

export interface EntityRisk {
  id: string;
  riskScore: number;
  criticalCount: number;
  totalShipments: number;
  country: string;
}

export type FilterState = {
  riskLevel: RiskLevel[];
  originCountries: string[];
  minRiskScore: number;
  maxRiskScore: number;
  searchQuery: string;
  anomalyOnly: boolean;
};

// ── API response types ───────────────────────────────────────────────────

export interface ApiPrediction {
  Container_ID: number | string;
  Risk_Score: number;
  Risk_Level: RiskLevel;
  Anomaly_Flag: number;
  Explanation_Summary: string;
}

export interface BatchSummary {
  total_containers: number;
  critical_count: number;
  low_risk_count: number;
  clear_count: number;
}

export interface BatchResponse {
  summary: BatchSummary;
  predictions: ApiPrediction[];
}
