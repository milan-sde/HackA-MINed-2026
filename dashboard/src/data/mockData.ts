import type { Container, TimelinePoint, AnomalyPattern, EntityRisk } from "@/types";

const COUNTRIES = [
  { code: "CN", name: "China", flag: "🇨🇳", riskWeight: 1.8 },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", riskWeight: 1.5 },
  { code: "TH", name: "Thailand", flag: "🇹🇭", riskWeight: 1.4 },
  { code: "KR", name: "South Korea", flag: "🇰🇷", riskWeight: 1.3 },
  { code: "DE", name: "Germany", flag: "🇩🇪", riskWeight: 0.6 },
  { code: "US", name: "United States", flag: "🇺🇸", riskWeight: 0.7 },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", riskWeight: 0.6 },
  { code: "JP", name: "Japan", flag: "🇯🇵", riskWeight: 0.8 },
  { code: "IN", name: "India", flag: "🇮🇳", riskWeight: 1.1 },
  { code: "BR", name: "Brazil", flag: "🇧🇷", riskWeight: 1.0 },
  { code: "BE", name: "Belgium", flag: "🇧🇪", riskWeight: 0.5 },
  { code: "MX", name: "Mexico", flag: "🇲🇽", riskWeight: 1.0 },
  { code: "TR", name: "Turkey", flag: "🇹🇷", riskWeight: 1.2 },
  { code: "SG", name: "Singapore", flag: "🇸🇬", riskWeight: 0.7 },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰", riskWeight: 1.3 },
];

const DEST_PORTS = ["PORT_10", "PORT_20", "PORT_30", "PORT_40", "PORT_50"];
const DEST_COUNTRIES = ["US", "DE", "FR", "GB", "CA", "AU", "NL", "UG", "BA", "MN"];
const HS_CODES = ["440890", "690722", "620822", "940350", "850440",
  "950300", "840990", "900191", "854231", "721310",
  "611020", "870332", "292249", "300490", "382490"];
const SHIPPING_LINES = ["LINE_MODE_10", "LINE_MODE_20", "LINE_MODE_30", "LINE_MODE_40"];

const EXPORTER_IDS = ["0VKY2BR", "8WDKMC6", "4DT3246", "PKUOG2P", "DWNJQL8",
  "9XRT5LM", "K2PQN7A", "BV3MSZ1", "FHLN0XC", "M8YQT4R"];
const IMPORTER_IDS = ["QLRUBN9", "7JD1S2X", "WI9O3I5", "6LI9721", "A4KP8WE",
  "R5NM2QZ", "HX7BT3Y", "D9LPK6V", "T1QRS0F", "N2WKX8J"];

function seededRand(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function pickFrom<T>(arr: T[], seed: number): T {
  return arr[Math.floor(seededRand(seed) * arr.length)];
}

function generateExplanation(riskLevel: string, wDisc: number, dwell: number, country: string): string {
  const parts: string[] = [];
  if (wDisc > 25) parts.push(`Weight discrepancy of ${wDisc.toFixed(1)}%`);
  if (dwell > 80) parts.push(`Extended dwell time (${dwell.toFixed(0)}hrs)`);
  if (["CN", "VN", "TH", "KR"].includes(country)) parts.push(`High-risk origin (${country})`);
  if (parts.length === 0) {
    if (riskLevel === "Low Risk") return "Moderate exporter risk score with elevated value ratio.";
    return "No significant anomalies detected.";
  }
  return parts.slice(0, 2).join(". ") + ".";
}

function generateKeyFactors(wDisc: number, dwell: number, exporterRisk: number, country: string): string[] {
  const factors: string[] = [];
  if (wDisc > 20) factors.push(`Weight diff ${wDisc.toFixed(1)}%`);
  if (dwell > 80) factors.push(`Dwell ${dwell.toFixed(0)}h`);
  if (exporterRisk > 0.08) factors.push("High-risk exporter");
  if (["CN", "VN", "TH", "KR"].includes(country)) factors.push(`Origin: ${country}`);
  if (factors.length === 0) factors.push("Normal profile");
  return factors.slice(0, 3);
}

export function generateContainers(count = 120): Container[] {
  const containers: Container[] = [];

  for (let i = 0; i < count; i++) {
    const seed = i * 137 + 42;
    const countryObj = pickFrom(COUNTRIES, seed);
    const baseRisk = countryObj.riskWeight;

    const declaredWeight = 20 + seededRand(seed + 1) * 15000;
    const weightDiscPct = seededRand(seed + 2) * 45 * baseRisk;
    const measured = declaredWeight * (1 + (weightDiscPct / 100) * (seededRand(seed + 3) > 0.5 ? 1 : -1));
    const declaredValue = 1000 + seededRand(seed + 4) * 500000;
    const dwellTime = 10 + seededRand(seed + 5) * 150 * baseRisk;
    const exporterRisk = seededRand(seed + 6) * 0.15 * baseRisk;

    // Calculate a realistic risk score
    let riskScore = 0;
    riskScore += Math.min(weightDiscPct / 45, 1) * 35;
    riskScore += Math.min(dwellTime / 150, 1) * 25;
    riskScore += exporterRisk * 100 * 0.2;
    riskScore += (["CN", "VN", "TH", "KR"].includes(countryObj.code) ? 15 : 0);
    riskScore += seededRand(seed + 7) * 10;  // noise
    riskScore = Math.min(Math.max(riskScore, 0), 99);

    const riskLevel: Container["riskLevel"] =
      riskScore >= 70 ? "Critical" : riskScore >= 30 ? "Low Risk" : "Clear";

    const anomalyFlag = riskScore >= 65 || (weightDiscPct > 30 && seededRand(seed + 8) > 0.3);

    const hsCode = pickFrom(HS_CODES, seed + 9);
    const dateOffset = Math.floor(seededRand(seed + 10) * 365);
    const date = new Date(2025, 0, 1);
    date.setDate(date.getDate() + dateOffset);

    containers.push({
      id: `CTR${String(10000000 + i * 7919).slice(0, 8)}`,
      riskScore: parseFloat(riskScore.toFixed(1)),
      riskLevel,
      anomalyFlag,
      originCountry: countryObj.code,
      originFlag: countryObj.flag,
      destinationCountry: pickFrom(DEST_COUNTRIES, seed + 11),
      destinationPort: pickFrom(DEST_PORTS, seed + 12),
      hsCode,
      hsChapter: parseInt(hsCode.slice(0, 2)),
      declaredValue: parseFloat(declaredValue.toFixed(2)),
      declaredWeight: parseFloat(declaredWeight.toFixed(1)),
      measuredWeight: parseFloat(measured.toFixed(3)),
      weightDiscrepancyPct: parseFloat(weightDiscPct.toFixed(2)),
      dwellTimeHours: parseFloat(dwellTime.toFixed(1)),
      importerId: pickFrom(IMPORTER_IDS, seed + 13),
      exporterId: pickFrom(EXPORTER_IDS, seed + 14),
      declarationDate: date.toISOString().split("T")[0],
      tradeRegime: seededRand(seed + 15) > 0.15 ? "Import" : seededRand(seed + 15) > 0.05 ? "Export" : "Transit",
      shippingLine: pickFrom(SHIPPING_LINES, seed + 16),
      explanation: generateExplanation(riskLevel, weightDiscPct, dwellTime, countryObj.code),
      keyRiskFactors: generateKeyFactors(weightDiscPct, dwellTime, exporterRisk, countryObj.code),
      featureScores: {
        weightDiscrepancy: parseFloat(Math.min(weightDiscPct / 45, 1).toFixed(3)),
        valueRatio: parseFloat((seededRand(seed + 17) * 0.9).toFixed(3)),
        dwellTime: parseFloat(Math.min(dwellTime / 150, 1).toFixed(3)),
        routeRisk: parseFloat((["CN", "VN", "TH", "KR"].includes(countryObj.code) ? 0.7 + seededRand(seed + 18) * 0.3 : seededRand(seed + 18) * 0.4).toFixed(3)),
        entityHistory: parseFloat((exporterRisk * 7).toFixed(3)),
      },
    } as Container);
  }

  return containers;
}

export const MOCK_CONTAINERS = generateContainers(130);

export function generateTimeline(): TimelinePoint[] {
  const points: TimelinePoint[] = [];
  const start = new Date(2025, 0, 1);
  for (let i = 0; i < 52; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 7);
    const seed = i * 31;
    const r = seededRand;
    const critical = Math.floor(3 + r(seed) * 8);
    const lowRisk = Math.floor(25 + r(seed + 1) * 30);
    const total = 140 + Math.floor(r(seed + 2) * 60);
    const clear = total - critical - lowRisk;
    points.push({
      date: d.toISOString().split("T")[0],
      critical,
      lowRisk,
      clear: Math.max(clear, 80),
      avgScore: parseFloat((20 + r(seed + 3) * 35).toFixed(1)),
    });
  }
  return points;
}

export const MOCK_TIMELINE = generateTimeline();

export const MOCK_ANOMALY_PATTERNS: AnomalyPattern[] = [
  { pattern: "High Weight Discrepancy (>25%)", count: 18, avgRisk: 78.4, description: "Measured weight significantly exceeds declared weight" },
  { pattern: "Extended Dwell Time (>100hrs)", count: 12, avgRisk: 71.2, description: "Container held at port beyond normal processing time" },
  { pattern: "High-Risk Origin + Underweight", count: 9, avgRisk: 82.1, description: "CN/VN origin with declared weight underreported" },
  { pattern: "Repeat Exporter Risk", count: 7, avgRisk: 74.6, description: "Exporter with historical Critical shipments" },
  { pattern: "Extreme Value Anomaly", count: 5, avgRisk: 65.3, description: "Declared value in 99th percentile" },
];

export const MOCK_RISKY_EXPORTERS: EntityRisk[] = [
  { id: "DWNJQL8", riskScore: 72.4, criticalCount: 8, totalShipments: 31, country: "CN" },
  { id: "0VKY2BR", riskScore: 61.2, criticalCount: 5, totalShipments: 28, country: "VN" },
  { id: "9XRT5LM", riskScore: 58.7, criticalCount: 4, totalShipments: 22, country: "TH" },
  { id: "K2PQN7A", riskScore: 55.1, criticalCount: 4, totalShipments: 19, country: "CN" },
  { id: "BV3MSZ1", riskScore: 52.8, criticalCount: 3, totalShipments: 17, country: "KR" },
  { id: "8WDKMC6", riskScore: 48.3, criticalCount: 3, totalShipments: 25, country: "CN" },
  { id: "FHLN0XC", riskScore: 45.6, criticalCount: 2, totalShipments: 15, country: "IN" },
  { id: "M8YQT4R", riskScore: 43.2, criticalCount: 2, totalShipments: 12, country: "TR" },
  { id: "4DT3246", riskScore: 39.8, criticalCount: 1, totalShipments: 11, country: "VN" },
  { id: "PKUOG2P", riskScore: 36.5, criticalCount: 1, totalShipments: 9, country: "CN" },
];

export const MOCK_RISKY_IMPORTERS: EntityRisk[] = [
  { id: "7JD1S2X", riskScore: 68.9, criticalCount: 6, totalShipments: 24, country: "US" },
  { id: "QLRUBN9", riskScore: 62.4, criticalCount: 5, totalShipments: 21, country: "CA" },
  { id: "A4KP8WE", riskScore: 57.1, criticalCount: 4, totalShipments: 18, country: "DE" },
  { id: "D9LPK6V", riskScore: 53.8, criticalCount: 3, totalShipments: 16, country: "GB" },
  { id: "WI9O3I5", riskScore: 49.2, criticalCount: 3, totalShipments: 20, country: "AU" },
  { id: "6LI9721", riskScore: 46.7, criticalCount: 2, totalShipments: 14, country: "NL" },
  { id: "R5NM2QZ", riskScore: 44.1, criticalCount: 2, totalShipments: 13, country: "FR" },
  { id: "HX7BT3Y", riskScore: 40.9, criticalCount: 1, totalShipments: 10, country: "IT" },
  { id: "T1QRS0F", riskScore: 37.5, criticalCount: 1, totalShipments: 8, country: "BE" },
  { id: "N2WKX8J", riskScore: 33.2, criticalCount: 0, totalShipments: 7, country: "SE" },
];
