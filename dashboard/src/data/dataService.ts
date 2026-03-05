import type { Container, KPIData, FilterState } from "@/types";
import { MOCK_CONTAINERS, MOCK_TIMELINE, MOCK_ANOMALY_PATTERNS, MOCK_RISKY_EXPORTERS, MOCK_RISKY_IMPORTERS, generateContainers } from "./mockData";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchContainers(filters?: Partial<FilterState>): Promise<Container[]> {
  await delay(300 + Math.random() * 200);
  let result = [...MOCK_CONTAINERS];

  if (filters) {
    if (filters.riskLevel?.length) result = result.filter((c) => filters.riskLevel!.includes(c.riskLevel));
    if (filters.originCountries?.length) result = result.filter((c) => filters.originCountries!.includes(c.originCountry));
    if (filters.minRiskScore !== undefined) result = result.filter((c) => c.riskScore >= filters.minRiskScore!);
    if (filters.maxRiskScore !== undefined) result = result.filter((c) => c.riskScore <= filters.maxRiskScore!);
    if (filters.anomalyOnly) result = result.filter((c) => c.anomalyFlag);
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter((c) =>
        c.id.toLowerCase().includes(q) ||
        c.importerId.toLowerCase().includes(q) ||
        c.exporterId.toLowerCase().includes(q)
      );
    }
  }
  return result;
}

export async function fetchKPIs(): Promise<KPIData> {
  await delay(200);
  const containers = MOCK_CONTAINERS;
  const criticalCount = containers.filter((c) => c.riskLevel === "Critical").length;
  const anomalyCount = containers.filter((c) => c.anomalyFlag).length;
  const avgRiskScore = containers.reduce((s, c) => s + c.riskScore, 0) / containers.length;
  return {
    totalContainers: containers.length,
    criticalCount,
    criticalPct: (criticalCount / containers.length) * 100,
    anomalyCount,
    anomalyRate: (anomalyCount / containers.length) * 100,
    avgRiskScore: parseFloat(avgRiskScore.toFixed(1)),
    trend: { total: +5.2, critical: -1.3, anomaly: +2.1, avgScore: -0.8 },
  };
}

export async function fetchTimeline() {
  await delay(250);
  return MOCK_TIMELINE;
}

export async function fetchAnomalyPatterns() {
  await delay(200);
  return MOCK_ANOMALY_PATTERNS;
}

export async function fetchEntityData() {
  await delay(250);
  return { exporters: MOCK_RISKY_EXPORTERS, importers: MOCK_RISKY_IMPORTERS };
}

export async function fetchContainerById(id: string): Promise<Container | null> {
  await delay(150);
  return MOCK_CONTAINERS.find((c) => c.id === id) ?? null;
}

export async function fetchSimilarContainers(container: Container): Promise<Container[]> {
  await delay(200);
  return MOCK_CONTAINERS.filter((c) =>
    c.id !== container.id && c.riskLevel === container.riskLevel
  ).slice(0, 5);
}

// Real-time simulation
let wsCallbacks: Array<(data: Container) => void> = [];
let wsInterval: ReturnType<typeof setInterval> | null = null;

export function subscribeToRealtime(onData: (container: Container) => void) {
  wsCallbacks.push(onData);
  if (!wsInterval) {
    wsInterval = setInterval(() => {
      const newContainers = generateContainers(1);
      wsCallbacks.forEach((cb) => cb(newContainers[0]));
    }, 5000);
  }
  return () => {
    wsCallbacks = wsCallbacks.filter((cb) => cb !== onData);
    if (wsCallbacks.length === 0 && wsInterval) {
      clearInterval(wsInterval);
      wsInterval = null;
    }
  };
}
