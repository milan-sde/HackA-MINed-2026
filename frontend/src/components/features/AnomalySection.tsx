import { useMemo } from "react";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RISK_COLORS } from "@/lib/utils";
import type { Container, AnomalyPattern } from "@/types";
import { deriveAnomalyPatterns } from "@/services/api";

interface Props {
  containers: Container[];
}

interface CustomDotProps {
  cx?: number;
  cy?: number;
  payload?: Container;
}

function CustomDot({ cx = 0, cy = 0, payload }: CustomDotProps) {
  if (!payload) return null;
  const color = RISK_COLORS[payload.riskLevel];
  const r = payload.anomalyFlag ? 6 : 4;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={color}
      fillOpacity={payload.anomalyFlag ? 0.9 : 0.55}
      stroke={payload.anomalyFlag ? color : "transparent"}
      strokeWidth={1.5}
    />
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: Container }>;
}

function ScatterTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const c = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-xs shadow-xl">
      <p className="font-mono font-semibold mb-1">{c.id}</p>
      <p>Risk Score: <span className="font-semibold">{c.riskScore.toFixed(1)}</span></p>
      <p>Weight Δ: <span className="font-semibold">{c.weightDiscrepancyPct.toFixed(1)}%</span></p>
      <p>Origin: {c.originFlag} {c.originCountry}</p>
      {c.anomalyFlag && (
        <p className="text-amber-400 font-semibold mt-1">⚠ Anomaly Flagged</p>
      )}
    </div>
  );
}

export default function AnomalySection({ containers }: Props) {
  const scatterData = useMemo(() => containers.slice(0, 130), [containers]);
  const anomalyPatterns = useMemo(() => deriveAnomalyPatterns(containers), [containers]);

  return (
    <div className="space-y-6">
      {/* Scatter Plot */}
      <Card>
        <CardHeader>
          <CardTitle>Weight Discrepancy vs Risk Score</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Each point is a container — anomaly-flagged are larger with border
          </p>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
            {(["Critical", "Low Risk", "Clear"] as const).map((rl) => (
              <span key={rl} className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: RISK_COLORS[rl] }} />
                {rl}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-muted-foreground">
              — Anomaly threshold (≥65 risk score)
            </span>
          </div>
          <ResponsiveContainer width="100%" height={340}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis
                dataKey="weightDiscrepancyPct"
                name="Weight Δ%"
                type="number"
                domain={[0, 45]}
                label={{ value: "Weight Discrepancy (%)", position: "insideBottom", offset: -10, fontSize: 11 }}
                tick={{ fontSize: 10 }}
                stroke="hsl(var(--border))"
              />
              <YAxis
                dataKey="riskScore"
                name="Risk Score"
                type="number"
                domain={[0, 100]}
                label={{ value: "Risk Score", angle: -90, position: "insideLeft", offset: 10, fontSize: 11 }}
                tick={{ fontSize: 10 }}
                stroke="hsl(var(--border))"
              />
              <ReferenceLine y={70} stroke="#EF4444" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "Critical", fill: "#EF4444", fontSize: 10 }} />
              <ReferenceLine y={30} stroke="#10B981" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "Clear", fill: "#10B981", fontSize: 10 }} />
              <ReferenceLine x={20} stroke="#F59E0B" strokeDasharray="4 3" strokeWidth={1.5} />
              <Tooltip content={<ScatterTooltip />} />
              <Scatter data={scatterData} shape={<CustomDot />}>
                {scatterData.map((c) => (
                  <Cell key={c.id} fill={RISK_COLORS[c.riskLevel]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Anomaly Patterns */}
      <Card>
        <CardHeader>
          <CardTitle>Detected Anomaly Patterns</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Isolation Forest + rule-based detection</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {anomalyPatterns.map((p: AnomalyPattern) => (
              <div
                key={p.pattern}
                className="rounded-lg border border-border bg-muted/20 p-4 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-xs font-semibold leading-snug">{p.pattern}</p>
                  <Badge
                    variant={p.avgRisk >= 70 ? "critical" : p.avgRisk >= 30 ? "lowrisk" : "clear"}
                    className="shrink-0 text-[10px]"
                  >
                    {p.avgRisk.toFixed(0)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{p.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{p.count} containers</span>
                  <div className="h-1.5 w-28 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(p.avgRisk / 100) * 100}%`,
                        background: p.avgRisk >= 70 ? "#EF4444" : p.avgRisk >= 30 ? "#F59E0B" : "#10B981",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
