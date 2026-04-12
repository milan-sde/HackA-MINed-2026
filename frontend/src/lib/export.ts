import type { Container, RiskLevel } from "@/types";
import type { FlaggedContainer } from "@/services/api";

interface ExportOptions {
  filenamePrefix?: string;
  riskLevels?: RiskLevel[];
  anomalyOnly?: boolean;
}

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? "");
  if (/[,"\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(escapeCsvCell).join(",");
  const lines = rows.map((row) =>
    headers.map((key) => escapeCsvCell(row[key])).join(","),
  );

  return [headerLine, ...lines].join("\n");
}

function triggerCsvDownload(csv: string, filenamePrefix: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filenamePrefix}_${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportContainersCSV(
  containers: Container[],
  options: ExportOptions = {},
): number {
  let result = containers;

  if (options.riskLevels?.length) {
    const allowed = new Set(options.riskLevels);
    result = result.filter((c) => allowed.has(c.riskLevel));
  }

  if (options.anomalyOnly) {
    result = result.filter((c) => c.anomalyFlag);
  }

  if (result.length === 0) return 0;

  const rows = result.map((c) => ({
    Container_ID: c.id,
    Risk_Score: Number(c.riskScore.toFixed(2)),
    Risk_Level: c.riskLevel,
    Anomaly_Flag: c.anomalyFlag ? 1 : 0,
    Origin_Country: c.originCountry,
    Destination_Country: c.destinationCountry,
    Destination_Port: c.destinationPort,
    HS_Code: c.hsCode,
    Declared_Value: c.declaredValue,
    Declared_Weight: c.declaredWeight,
    Measured_Weight: c.measuredWeight,
    Weight_Discrepancy_Pct: Number(c.weightDiscrepancyPct.toFixed(2)),
    Dwell_Time_Hours: c.dwellTimeHours,
    Importer_ID: c.importerId,
    Exporter_ID: c.exporterId,
    Declaration_Date: c.declarationDate,
    Trade_Regime: c.tradeRegime,
    Explanation_Summary: c.explanation,
    Key_Risk_Factors: c.keyRiskFactors.join(" | "),
  }));

  triggerCsvDownload(rowsToCsv(rows), options.filenamePrefix ?? "containers_export");
  return result.length;
}

export function exportFlaggedCSV(
  flagged: FlaggedContainer[],
  filenamePrefix = "flagged_containers",
): number {
  if (flagged.length === 0) return 0;

  const rows = flagged.map((f) => ({
    Container_ID: f.container_id,
    Risk_Score: f.risk_score ?? "",
    Status: f.status,
    Note: f.note,
    Timestamp: f.timestamp,
  }));

  triggerCsvDownload(rowsToCsv(rows), filenamePrefix);
  return flagged.length;
}
