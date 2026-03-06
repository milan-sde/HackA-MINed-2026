import type { Container, RiskLevel } from "@/types";
import { useDashboardStore, type RiskAlert } from "@/store/dashboardStore";
import { toast } from "sonner";

const API_BASE = "http://localhost:8000";

// ── Realistic random data pools ──────────────────────────────────────────

const ORIGINS = [
  "CN", "VN", "TH", "KR", "DE", "US", "GB", "JP", "IN", "BR",
  "BE", "MX", "TR", "SG", "HK", "FR", "CA", "AU", "NL", "IT",
  "SE", "UG", "BA", "MN",
];

const DESTINATIONS = [
  "IN", "US", "DE", "GB", "JP", "FR", "CA", "AU", "NL", "IT",
  "BE", "SG", "BR", "MX", "KR", "SE",
];

const HS_CODES = [
  "8542", "8471", "6110", "3004", "8703", "2710", "7108", "8517",
  "9403", "6204", "8528", "3808", "7304", "8501", "6109", "2204",
  "8443", "4011", "3926", "6402",
];

const PORTS = [
  "Mumbai", "Shanghai", "Rotterdam", "Hamburg", "Singapore",
  "Los Angeles", "Tokyo", "Busan", "Antwerp", "Felixstowe",
];

const COUNTRY_FLAGS: Record<string, string> = {
  CN: "\u{1F1E8}\u{1F1F3}", VN: "\u{1F1FB}\u{1F1F3}", TH: "\u{1F1F9}\u{1F1ED}",
  KR: "\u{1F1F0}\u{1F1F7}", DE: "\u{1F1E9}\u{1F1EA}", US: "\u{1F1FA}\u{1F1F8}",
  GB: "\u{1F1EC}\u{1F1E7}", JP: "\u{1F1EF}\u{1F1F5}", IN: "\u{1F1EE}\u{1F1F3}",
  BR: "\u{1F1E7}\u{1F1F7}", BE: "\u{1F1E7}\u{1F1EA}", MX: "\u{1F1F2}\u{1F1FD}",
  TR: "\u{1F1F9}\u{1F1F7}", SG: "\u{1F1F8}\u{1F1EC}", HK: "\u{1F1ED}\u{1F1F0}",
  FR: "\u{1F1EB}\u{1F1F7}", CA: "\u{1F1E8}\u{1F1E6}", AU: "\u{1F1E6}\u{1F1FA}",
  NL: "\u{1F1F3}\u{1F1F1}", IT: "\u{1F1EE}\u{1F1F9}", SE: "\u{1F1F8}\u{1F1EA}",
  UG: "\u{1F1FA}\u{1F1EC}", BA: "\u{1F1E7}\u{1F1E6}", MN: "\u{1F1F2}\u{1F1F3}",
};

const HIGH_RISK_ORIGINS = new Set(["CN", "TH", "KR", "VN"]);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

let _nextId = 900000;

// ── Generate a single random container payload ───────────────────────────

function generateContainerPayload() {
  const id = _nextId++;
  const declaredWeight = Math.round(rand(200, 25000));
  const discrepancy = Math.random() < 0.15 ? rand(0.15, 0.45) : rand(-0.05, 0.08);
  const measuredWeight = Math.round(declaredWeight * (1 + discrepancy));
  const declaredValue = Math.round(rand(1000, 120000));
  const origin = pick(ORIGINS);
  const destination = pick(DESTINATIONS.filter((d) => d !== origin));
  const hsCode = pick(HS_CODES);
  const dwellTime = Math.random() < 0.1 ? rand(80, 200) : rand(2, 72);

  return {
    Container_ID: id,
    Declared_Value: declaredValue,
    Declared_Weight: declaredWeight,
    Measured_Weight: Math.max(measuredWeight, 1),
    Origin_Country: origin,
    Destination_Country: destination,
    HS_Code: hsCode,
    Importer_ID: `IMP${String(Math.floor(rand(100, 999))).padStart(3, "0")}`,
    Exporter_ID: `EXP${String(Math.floor(rand(100, 999))).padStart(3, "0")}`,
    Dwell_Time_Hours: parseFloat(dwellTime.toFixed(1)),
  };
}

// ── Call /predict and transform to Container ─────────────────────────────

interface PredictResponse {
  Container_ID: number | string;
  Risk_Score: number;
  Risk_Level: string;
  Anomaly_Flag: number;
  Explanation_Summary: string;
}

function buildKeyRiskFactors(
  weightDiscPct: number,
  dwellTime: number,
  origin: string,
): string[] {
  const factors: string[] = [];
  if (weightDiscPct > 20) factors.push(`Weight diff ${weightDiscPct.toFixed(1)}%`);
  if (dwellTime > 80) factors.push(`Dwell ${dwellTime.toFixed(0)}h`);
  if (HIGH_RISK_ORIGINS.has(origin)) factors.push(`Origin: ${origin}`);
  if (factors.length === 0) factors.push("Normal profile");
  return factors.slice(0, 3);
}

async function predictSingle(
  payload: ReturnType<typeof generateContainerPayload>,
): Promise<Container> {
  const res = await fetch(`${API_BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Predict API error: ${res.status}`);
  }

  const pred: PredictResponse = await res.json();
  const declaredWeight = payload.Declared_Weight;
  const measuredWeight = payload.Measured_Weight;
  const declaredValue = payload.Declared_Value;
  const origin = payload.Origin_Country;
  const hsCode = payload.HS_Code;
  const weightDiscPct =
    (Math.abs(measuredWeight - declaredWeight) / (declaredWeight + 0.001)) * 100;
  const isHighRisk = HIGH_RISK_ORIGINS.has(origin);
  const valuePerKg = declaredValue / (declaredWeight + 0.001);

  return {
    id: String(pred.Container_ID),
    riskScore: parseFloat(pred.Risk_Score.toFixed(1)),
    riskLevel: pred.Risk_Level as RiskLevel,
    anomalyFlag: pred.Anomaly_Flag === 1,
    originCountry: origin,
    originFlag: COUNTRY_FLAGS[origin] ?? "\u{1F3F3}\u{FE0F}",
    destinationCountry: payload.Destination_Country,
    destinationPort: pick(PORTS),
    hsCode,
    hsChapter: parseInt(hsCode.slice(0, 2)) || 0,
    declaredValue,
    declaredWeight,
    measuredWeight,
    weightDiscrepancyPct: parseFloat(weightDiscPct.toFixed(2)),
    dwellTimeHours: payload.Dwell_Time_Hours,
    importerId: payload.Importer_ID,
    exporterId: payload.Exporter_ID,
    declarationDate: new Date().toISOString().split("T")[0],
    tradeRegime: pick(["Import", "Export", "Transit"] as const),
    explanation: pred.Explanation_Summary,
    keyRiskFactors: buildKeyRiskFactors(weightDiscPct, payload.Dwell_Time_Hours, origin),
    featureScores: {
      weightDiscrepancy: parseFloat(Math.min(weightDiscPct / 45, 1).toFixed(3)),
      valueRatio: parseFloat(Math.min(valuePerKg / 500, 1).toFixed(3)),
      dwellTime: parseFloat(Math.min(payload.Dwell_Time_Hours / 150, 1).toFixed(3)),
      routeRisk: isHighRisk ? 0.8 : 0.2,
      entityHistory: 0,
    },
  };
}

// ── Simulation controller ────────────────────────────────────────────────

let _intervalId: ReturnType<typeof setInterval> | null = null;

export function startSimulation() {
  if (_intervalId) return;

  const store = useDashboardStore.getState();
  store.setSimulationRunning(true);

  toast.success("Live Monitoring started", {
    description: "Simulating incoming containers every 3 seconds",
  });

  tick();
  _intervalId = setInterval(tick, 3000);
}

export function stopSimulation() {
  if (_intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
  const store = useDashboardStore.getState();
  store.setSimulationRunning(false);

  toast.info("Live Monitoring paused", {
    description: `${store.simulatedCount} containers simulated this session`,
  });
}

async function tick() {
  const store = useDashboardStore.getState();
  if (!store.simulationRunning && _intervalId) {
    clearInterval(_intervalId);
    _intervalId = null;
    return;
  }

  try {
    const payload = generateContainerPayload();
    const container = await predictSingle(payload);

    useDashboardStore.getState().appendContainer(container);

    if (container.riskLevel === "Critical") {
      const alert: RiskAlert = {
        id: `alert-${container.id}-${Date.now()}`,
        containerId: container.id,
        riskScore: container.riskScore,
        riskLevel: container.riskLevel,
        explanation: container.explanation,
        origin: container.originCountry,
        timestamp: Date.now(),
      };
      useDashboardStore.getState().addRiskAlert(alert);

      toast.error(`CRITICAL: Container ${container.id}`, {
        description: container.explanation,
        duration: 6000,
      });
    } else if (container.riskLevel === "Low Risk" && container.riskScore > 55) {
      toast.warning(`Low Risk: Container ${container.id}`, {
        description: container.explanation,
        duration: 4000,
      });
    }
  } catch {
    toast.error("Simulation error", {
      description: "Failed to reach prediction API. Is the backend running?",
      duration: 5000,
    });
    stopSimulation();
  }
}

export function isSimulationRunning(): boolean {
  return _intervalId !== null;
}
