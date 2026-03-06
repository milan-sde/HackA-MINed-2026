import type {
  BatchResponse,
  Container,
  RiskLevel,
  AnomalyPattern,
  EntityRisk,
  KPIData,
  TimelinePoint,
} from "@/types";

const API_BASE = "http://localhost:8000";

// ── Country flag lookup ──────────────────────────────────────────────────

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

function getFlag(code: string): string {
  return COUNTRY_FLAGS[code.toUpperCase()] ?? "\u{1F3F3}\u{FE0F}";
}

const HIGH_RISK_ORIGINS = new Set(["CN", "TH", "KR", "VN"]);

// ── CSV parser ───────────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = splitCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h.trim()] = vals[i]?.trim() ?? ""));
    return row;
  });
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Data merger ──────────────────────────────────────────────────────────

function buildKeyRiskFactors(
  weightDiscPct: number,
  dwellTime: number,
  exporterRisk: number,
  origin: string,
): string[] {
  const factors: string[] = [];
  if (weightDiscPct > 20) factors.push(`Weight diff ${weightDiscPct.toFixed(1)}%`);
  if (dwellTime > 80) factors.push(`Dwell ${dwellTime.toFixed(0)}h`);
  if (exporterRisk > 0.08) factors.push("High-risk exporter");
  if (HIGH_RISK_ORIGINS.has(origin.toUpperCase())) factors.push(`Origin: ${origin}`);
  if (factors.length === 0) factors.push("Normal profile");
  return factors.slice(0, 3);
}

function mergeData(
  csvRows: Record<string, string>[],
  predictions: BatchResponse["predictions"],
): Container[] {
  const predMap = new Map(
    predictions.map((p) => [String(p.Container_ID), p]),
  );

  return csvRows
    .map((row) => {
      const cid = row["Container_ID"] ?? "";
      const pred = predMap.get(cid);
      if (!pred) return null;

      const declaredWeight = parseFloat(row["Declared_Weight"]) || 0;
      const measuredWeight = parseFloat(row["Measured_Weight"]) || 0;
      const declaredValue = parseFloat(row["Declared_Value"]) || 0;
      const dwellTime = parseFloat(row["Dwell_Time_Hours"]) || 0;
      const origin = row["Origin_Country"] ?? "";
      const hsCode = row["HS_Code"] ?? "";
      const weightDiscPct =
        (Math.abs(measuredWeight - declaredWeight) / (declaredWeight + 0.001)) * 100;

      const tradeRaw = row["Trade_Regime (Import / Export / Transit)"] ?? "Import";
      const tradeRegime = (
        tradeRaw.includes("Export") ? "Export"
          : tradeRaw.includes("Transit") ? "Transit"
            : "Import"
      ) as Container["tradeRegime"];

      const dateCol =
        row["Declaration_Date (YYYY-MM-DD)"] ??
        row["Declaration_Date"] ??
        new Date().toISOString().split("T")[0];

      const isHighRisk = HIGH_RISK_ORIGINS.has(origin.toUpperCase());
      const valuePerKg = declaredValue / (declaredWeight + 0.001);

      return {
        id: String(pred.Container_ID),
        riskScore: parseFloat(pred.Risk_Score.toFixed(1)),
        riskLevel: pred.Risk_Level as RiskLevel,
        anomalyFlag: pred.Anomaly_Flag === 1,
        originCountry: origin,
        originFlag: getFlag(origin),
        destinationCountry: row["Destination_Country"] ?? "",
        destinationPort: row["Destination_Port"] ?? "",
        hsCode,
        hsChapter: parseInt(hsCode.slice(0, 2)) || 0,
        declaredValue,
        declaredWeight,
        measuredWeight,
        weightDiscrepancyPct: parseFloat(weightDiscPct.toFixed(2)),
        dwellTimeHours: parseFloat(dwellTime.toFixed(1)),
        importerId: row["Importer_ID"] ?? "",
        exporterId: row["Exporter_ID"] ?? "",
        declarationDate: dateCol,
        tradeRegime,
        explanation: pred.Explanation_Summary,
        keyRiskFactors: buildKeyRiskFactors(weightDiscPct, dwellTime, 0, origin),
        featureScores: {
          weightDiscrepancy: parseFloat(Math.min(weightDiscPct / 45, 1).toFixed(3)),
          valueRatio: parseFloat(Math.min(valuePerKg / 500, 1).toFixed(3)),
          dwellTime: parseFloat(Math.min(dwellTime / 150, 1).toFixed(3)),
          routeRisk: isHighRisk ? 0.8 : 0.2,
          entityHistory: 0,
        },
      } satisfies Container;
    })
    .filter((c): c is Container => c !== null);
}

// ── Types for flag / note APIs ────────────────────────────────────────────

export interface FlaggedContainer {
  container_id: string;
  risk_score: number | null;
  note: string;
  timestamp: string;
  status: string;
}

export interface ContainerNote {
  container_id: string;
  note: string;
  timestamp: string;
}

// ── API functions ────────────────────────────────────────────────────────

export interface UploadResult {
  containers: Container[];
  summary: BatchResponse["summary"];
}

export async function uploadCSV(file: File): Promise<UploadResult> {
  const csvText = await file.text();
  const csvRows = parseCSV(csvText);

  if (csvRows.length === 0) {
    throw new Error("CSV file is empty or could not be parsed.");
  }

  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${API_BASE}/predict-batch`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error (${res.status}): ${body}`);
  }

  const data: BatchResponse = await res.json();
  const containers = mergeData(csvRows, data.predictions);

  const result: UploadResult = { containers, summary: data.summary };
  _cachedResult = result;
  return result;
}

let _cachedResult: UploadResult | null = null;

/**
 * Returns the most recent prediction result from the last `uploadCSV` call,
 * or `null` if no CSV has been uploaded yet.
 */
export function fetchPredictions(): UploadResult | null {
  return _cachedResult;
}

// ── Load containers from backend (GET /containers) ───────────────────────

interface ContainerRecord {
  Container_ID: number | string;
  Risk_Score: number;
  Risk_Level: string;
  Anomaly_Flag: number;
  Explanation_Summary: string;
  // full_predictions.csv may include extra columns
  [key: string]: unknown;
}

function recordToContainer(r: ContainerRecord): Container {
  const origin = String(r.Origin_Country ?? r.originCountry ?? "");
  const dest = String(r.Destination_Country ?? r.destinationCountry ?? "");
  const hsCode = String(r.HS_Code ?? r.hsCode ?? "0000");
  const declaredWeight = Number(r.Declared_Weight ?? r.declaredWeight ?? 0);
  const measuredWeight = Number(r.Measured_Weight ?? r.measuredWeight ?? 0);
  const declaredValue = Number(r.Declared_Value ?? r.declaredValue ?? 0);
  const dwellTime = Number(r.Dwell_Time_Hours ?? r.dwellTimeHours ?? 0);
  const weightDiscPct =
    (Math.abs(measuredWeight - declaredWeight) / (declaredWeight + 0.001)) * 100;
  const isHighRisk = HIGH_RISK_ORIGINS.has(origin.toUpperCase());
  const valuePerKg = declaredValue / (declaredWeight + 0.001);

  const dateCol =
    String(r["Declaration_Date (YYYY-MM-DD)"] ?? r.Declaration_Date ?? r.declarationDate ?? new Date().toISOString().split("T")[0]);

  const tradeRaw = String(r["Trade_Regime (Import / Export / Transit)"] ?? r.Trade_Regime ?? r.tradeRegime ?? "Import");
  const tradeRegime: Container["tradeRegime"] =
    tradeRaw.includes("Export") ? "Export" : tradeRaw.includes("Transit") ? "Transit" : "Import";

  return {
    id: String(r.Container_ID),
    riskScore: parseFloat(Number(r.Risk_Score).toFixed(1)),
    riskLevel: r.Risk_Level as RiskLevel,
    anomalyFlag: r.Anomaly_Flag === 1,
    originCountry: origin,
    originFlag: getFlag(origin),
    destinationCountry: dest,
    destinationPort: String(r.Destination_Port ?? r.destinationPort ?? ""),
    hsCode,
    hsChapter: parseInt(hsCode.slice(0, 2)) || 0,
    declaredValue,
    declaredWeight,
    measuredWeight,
    weightDiscrepancyPct: parseFloat(weightDiscPct.toFixed(2)),
    dwellTimeHours: parseFloat(dwellTime.toFixed(1)),
    importerId: String(r.Importer_ID ?? r.importerId ?? ""),
    exporterId: String(r.Exporter_ID ?? r.exporterId ?? ""),
    declarationDate: dateCol,
    tradeRegime,
    explanation: r.Explanation_Summary,
    keyRiskFactors: buildKeyRiskFactors(weightDiscPct, dwellTime, 0, origin),
    featureScores: {
      weightDiscrepancy: parseFloat(Math.min(weightDiscPct / 45, 1).toFixed(3)),
      valueRatio: parseFloat(Math.min(valuePerKg / 500, 1).toFixed(3)),
      dwellTime: parseFloat(Math.min(dwellTime / 150, 1).toFixed(3)),
      routeRisk: isHighRisk ? 0.8 : 0.2,
      entityHistory: 0,
    },
  };
}

export async function fetchContainersFromAPI(): Promise<Container[]> {
  const res = await fetch(`${API_BASE}/containers`);
  if (!res.ok) {
    throw new Error(`Failed to load containers: ${res.status}`);
  }
  const records: ContainerRecord[] = await res.json();
  return records.map(recordToContainer);
}

// ── Flag container ───────────────────────────────────────────────────────

export async function flagContainer(
  containerId: string,
  note: string = "",
): Promise<FlaggedContainer> {
  const res = await fetch(`${API_BASE}/flag-container`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ container_id: containerId, note }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body);
  }
  return res.json();
}

// ── Get flagged containers ───────────────────────────────────────────────

export async function fetchFlaggedContainers(): Promise<FlaggedContainer[]> {
  const res = await fetch(`${API_BASE}/flagged-containers`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

// ── Container notes ──────────────────────────────────────────────────────

export async function addContainerNote(
  containerId: string,
  note: string,
): Promise<ContainerNote> {
  const res = await fetch(`${API_BASE}/container-note`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ container_id: containerId, note }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body);
  }
  return res.json();
}

export async function fetchContainerNotes(
  containerId: string,
): Promise<ContainerNote[]> {
  const res = await fetch(`${API_BASE}/container-notes/${containerId}`);
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

// ── Derived analytics (computed from live containers) ────────────────────

export function deriveKPIs(containers: Container[]): KPIData {
  const total = containers.length;
  if (total === 0) {
    return {
      totalContainers: 0, criticalCount: 0, criticalPct: 0,
      lowRiskCount: 0, lowRiskPct: 0, clearCount: 0, clearPct: 0,
      anomalyCount: 0, anomalyRate: 0, avgRiskScore: 0,
      trend: { total: 0, critical: 0, anomaly: 0, avgScore: 0 },
    };
  }
  const criticalCount = containers.filter((c) => c.riskLevel === "Critical").length;
  const lowRiskCount = containers.filter((c) => c.riskLevel === "Low Risk").length;
  const clearCount = containers.filter((c) => c.riskLevel === "Clear").length;
  const anomalyCount = containers.filter((c) => c.anomalyFlag).length;
  const avgRiskScore =
    containers.reduce((s, c) => s + c.riskScore, 0) / total;

  return {
    totalContainers: total,
    criticalCount,
    criticalPct: parseFloat(((criticalCount / total) * 100).toFixed(1)),
    lowRiskCount,
    lowRiskPct: parseFloat(((lowRiskCount / total) * 100).toFixed(1)),
    clearCount,
    clearPct: parseFloat(((clearCount / total) * 100).toFixed(1)),
    anomalyCount,
    anomalyRate: parseFloat(((anomalyCount / total) * 100).toFixed(1)),
    avgRiskScore: parseFloat(avgRiskScore.toFixed(1)),
    trend: { total: 0, critical: 0, anomaly: 0, avgScore: 0 },
  };
}

export function deriveTimeline(containers: Container[]): TimelinePoint[] {
  const byDate = new Map<string, Container[]>();
  for (const c of containers) {
    const d = c.declarationDate;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(c);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, group]) => ({
      date,
      critical: group.filter((c) => c.riskLevel === "Critical").length,
      lowRisk: group.filter((c) => c.riskLevel === "Low Risk").length,
      clear: group.filter((c) => c.riskLevel === "Clear").length,
      avgScore: parseFloat(
        (group.reduce((s, c) => s + c.riskScore, 0) / group.length).toFixed(1),
      ),
    }));
}

export function deriveAnomalyPatterns(containers: Container[]): AnomalyPattern[] {
  const highWeight = containers.filter((c) => c.weightDiscrepancyPct > 25);
  const extDwell = containers.filter((c) => c.dwellTimeHours > 100);
  const highRiskUnder = containers.filter(
    (c) =>
      HIGH_RISK_ORIGINS.has(c.originCountry.toUpperCase()) &&
      c.measuredWeight > c.declaredWeight * 1.2,
  );
  const extremeVal = containers.filter(
    (c) => c.featureScores.valueRatio > 0.9,
  );

  const avg = (arr: Container[]) =>
    arr.length
      ? parseFloat(
          (arr.reduce((s, c) => s + c.riskScore, 0) / arr.length).toFixed(1),
        )
      : 0;

  return [
    {
      pattern: "High Weight Discrepancy (>25%)",
      count: highWeight.length,
      avgRisk: avg(highWeight),
      description: "Measured weight significantly exceeds declared weight",
    },
    {
      pattern: "Extended Dwell Time (>100hrs)",
      count: extDwell.length,
      avgRisk: avg(extDwell),
      description: "Container held at port beyond normal processing time",
    },
    {
      pattern: "High-Risk Origin + Underweight",
      count: highRiskUnder.length,
      avgRisk: avg(highRiskUnder),
      description: "CN/VN/TH/KR origin with declared weight underreported",
    },
    {
      pattern: "Extreme Value Anomaly",
      count: extremeVal.length,
      avgRisk: avg(extremeVal),
      description: "Declared value in 99th percentile",
    },
  ].filter((p) => p.count > 0);
}

export interface CountryRisk {
  country: string;
  totalContainers: number;
  criticalCount: number;
  lowRiskCount: number;
  clearCount: number;
  avgRiskScore: number;
  riskRate: number;
}

export function deriveCountryRisk(containers: Container[]): CountryRisk[] {
  const groups = new Map<string, Container[]>();
  for (const c of containers) {
    const code = c.originCountry.toUpperCase();
    if (!code) continue;
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code)!.push(c);
  }

  return [...groups.entries()]
    .map(([country, group]) => {
      const criticalCount = group.filter((c) => c.riskLevel === "Critical").length;
      const lowRiskCount = group.filter((c) => c.riskLevel === "Low Risk").length;
      return {
        country,
        totalContainers: group.length,
        criticalCount,
        lowRiskCount,
        clearCount: group.length - criticalCount - lowRiskCount,
        avgRiskScore: parseFloat(
          (group.reduce((s, c) => s + c.riskScore, 0) / group.length).toFixed(1),
        ),
        riskRate: parseFloat(
          ((criticalCount / group.length) * 100).toFixed(1),
        ),
      };
    })
    .sort((a, b) => b.avgRiskScore - a.avgRiskScore);
}

export function deriveEntityRisk(
  containers: Container[],
  field: "exporterId" | "importerId",
): EntityRisk[] {
  const groups = new Map<string, Container[]>();
  for (const c of containers) {
    const id = c[field];
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(c);
  }

  return [...groups.entries()]
    .map(([id, group]) => ({
      id,
      riskScore: parseFloat(
        (group.reduce((s, c) => s + c.riskScore, 0) / group.length).toFixed(1),
      ),
      criticalCount: group.filter((c) => c.riskLevel === "Critical").length,
      totalShipments: group.length,
      country: group[0].originCountry,
    }))
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10);
}

// ── Anomaly type classification ──────────────────────────────────────────

export type AnomalyType =
  | "weight_mismatch"
  | "dwell_time"
  | "value_anomaly"
  | "exporter_risk"
  | "normal";

export const ANOMALY_TYPE_META: Record<
  AnomalyType,
  { label: string; color: string; icon: string }
> = {
  weight_mismatch: { label: "Weight Mismatch", color: "#EF4444", icon: "Scale" },
  dwell_time: { label: "Dwell Time", color: "#F59E0B", icon: "Clock" },
  value_anomaly: { label: "Value Anomaly", color: "#8B5CF6", icon: "DollarSign" },
  exporter_risk: { label: "Exporter Risk", color: "#F97316", icon: "UserX" },
  normal: { label: "Normal", color: "#10B981", icon: "CheckCircle" },
};

export function getAnomalyType(c: Container): AnomalyType {
  if (c.weightDiscrepancyPct > 20) return "weight_mismatch";
  if (c.dwellTimeHours > 80) return "dwell_time";
  if (c.featureScores.valueRatio > 0.7) return "value_anomaly";
  if (
    HIGH_RISK_ORIGINS.has(c.originCountry.toUpperCase()) &&
    c.featureScores.routeRisk > 0.5
  )
    return "exporter_risk";
  return "normal";
}

export function getRecommendedAction(c: Container): string {
  if (c.riskLevel === "Critical") {
    if (c.weightDiscrepancyPct > 30) return "Physical inspection — weigh & X-ray scan";
    if (c.dwellTimeHours > 100) return "Priority release review — check holds";
    if (c.featureScores.valueRatio > 0.8) return "Value verification — request invoices";
    return "Full inspection — document & physical check";
  }
  if (c.riskLevel === "Low Risk") {
    if (c.weightDiscrepancyPct > 15) return "Spot-check weight verification";
    if (c.anomalyFlag) return "Document review — verify declarations";
    return "Monitor — routine screening";
  }
  return "Auto-release — no action required";
}

export interface AnomalyDistribution {
  type: AnomalyType;
  label: string;
  count: number;
  color: string;
}

export function deriveAnomalyDistribution(
  containers: Container[],
): AnomalyDistribution[] {
  const counts = new Map<AnomalyType, number>();
  for (const c of containers) {
    const t = getAnomalyType(c);
    if (t === "normal") continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }

  return (
    ["weight_mismatch", "dwell_time", "value_anomaly", "exporter_risk"] as AnomalyType[]
  )
    .map((type) => ({
      type,
      label: ANOMALY_TYPE_META[type].label,
      count: counts.get(type) ?? 0,
      color: ANOMALY_TYPE_META[type].color,
    }))
    .filter((d) => d.count > 0);
}


// ── Notifications ────────────────────────────────────────────────────────

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: "critical" | "warning" | "success" | "info";
  is_read: boolean;
  created_at: string;
}

export async function fetchNotifications(): Promise<Notification[]> {
  const res = await fetch(`${API_BASE}/notifications`);
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json();
}

export async function markNotificationsRead(): Promise<void> {
  await fetch(`${API_BASE}/notifications/read`, { method: "POST" });
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await fetch(`${API_BASE}/notifications/unread-count`);
  if (!res.ok) return 0;
  const data = await res.json();
  return data.count;
}
