import { useState, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, Area, AreaChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { TimelinePoint } from "@/types";

interface RiskTimelineProps {
  data: TimelinePoint[];
  loading?: boolean;
}

type Granularity = "weekly" | "monthly";

const CUSTOM_TOOLTIP = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover p-3 shadow-xl text-xs min-w-[140px]">
      <p className="font-semibold mb-2 text-foreground">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground capitalize">{p.name}</span>
          </div>
          <span className="font-medium tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function RiskTimeline({ data, loading }: RiskTimelineProps) {
  const [granularity, setGranularity] = useState<Granularity>("weekly");
  const [view, setView] = useState<"counts" | "score">("counts");

  const chartData = useMemo(() => {
    if (granularity === "weekly") return data.map((d) => ({ ...d, label: d.date.slice(5) }));
    // Aggregate monthly
    const monthly: Record<string, TimelinePoint & { label: string; count: number }> = {};
    data.forEach((d) => {
      const key = d.date.slice(0, 7);
      if (!monthly[key]) monthly[key] = { ...d, date: key, label: key, count: 0 };
      const m = monthly[key];
      m.critical += d.critical;
      m.lowRisk += d.lowRisk;
      m.clear += d.clear;
      m.avgScore = (m.avgScore * m.count + d.avgScore) / (m.count + 1);
      m.count++;
    });
    return Object.values(monthly).map((d) => ({ ...d, label: d.date }));
  }, [data, granularity]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold">Risk Trend Timeline</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl bg-muted p-0.5 overflow-hidden">
              {(["counts", "score"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${view === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {v === "counts" ? "Risk Levels" : "Avg Score"}
                </button>
              ))}
            </div>
            <div className="flex rounded-xl bg-muted p-0.5 overflow-hidden">
              {(["weekly", "monthly"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGranularity(g)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${granularity === g ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          {loading ? (
            <div className="h-full skeleton rounded-md" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {view === "counts" ? (
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gCritical" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gLowRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                  <Tooltip content={<CUSTOM_TOOLTIP />} />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>} />
                  <Area type="monotone" dataKey="critical" name="Critical" stroke="#EF4444" fill="url(#gCritical)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                  <Area type="monotone" dataKey="lowRisk" name="Low Risk" stroke="#F59E0B" fill="url(#gLowRisk)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--border))" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--border))" />
                  <Tooltip content={<CUSTOM_TOOLTIP />} />
                  <ReferenceLine y={70} stroke="#EF4444" strokeDasharray="4 2" label={{ value: "Critical ·70", position: "insideTopRight", fontSize: 10, fill: "#EF4444" }} />
                  <ReferenceLine y={30} stroke="#F59E0B" strokeDasharray="4 2" label={{ value: "Low Risk · 30", position: "insideTopRight", fontSize: 10, fill: "#F59E0B" }} />
                  <Line type="monotone" dataKey="avgScore" name="Avg Score" stroke="#06B6D4" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
