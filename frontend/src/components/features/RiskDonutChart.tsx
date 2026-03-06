import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RISK_COLORS } from "@/lib/utils";
import type { Container, RiskLevel } from "@/types";
import { useDashboardStore } from "@/store/dashboardStore";

// Recharts v3 types don't include activeIndex/activeShape on Pie but they work at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FlexPie = Pie as any;

interface RiskDonutChartProps {
  containers: Container[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value, percent } = props;
  return (
    <g>
      <text x={cx} y={cy - 12} textAnchor="middle" fill="hsl(var(--foreground))" className="text-lg font-bold" fontSize={22} fontWeight={700}>
        {value}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={12}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 28} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={11}>
        {(percent * 100).toFixed(1)}%
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 12} outerRadius={outerRadius + 16} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
}

export default function RiskDonutChart({ containers }: RiskDonutChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const { setFilter, filters } = useDashboardStore();

  const counts = containers.reduce(
    (acc, c) => { acc[c.riskLevel] = (acc[c.riskLevel] || 0) + 1; return acc; },
    {} as Record<RiskLevel, number>
  );

  const data = (["Critical", "Low Risk", "Clear"] as RiskLevel[])
    .filter((k) => counts[k] > 0)
    .map((name) => ({ name, value: counts[name] || 0, fill: RISK_COLORS[name] }));

  function handleClick(entry: { name: string }) {
    const level = entry.name as RiskLevel;
    const current = filters.riskLevel;
    const next = current.includes(level) ? current.filter((x) => x !== level) : [...current, level];
    setFilter("riskLevel", next);
  }

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; value: number }; value: number }> }) => {
    if (!active || !payload?.length) return null;
    const { name, value } = payload[0].payload;
    const p = ((value / containers.length) * 100).toFixed(1);
    const color = RISK_COLORS[name as RiskLevel];
    return (
      <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-xl text-xs">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-2 w-2 rounded-full" style={{ background: color }} />
          <span className="font-semibold">{name}</span>
        </div>
        <p>{value.toLocaleString()} containers · {p}%</p>
        <p className="text-muted-foreground mt-0.5">Click to filter</p>
      </div>
    );
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Risk Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart style={{ cursor: "pointer" }}>
              <FlexPie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={90}
                dataKey="value"
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
                onMouseEnter={(_: unknown, i: number) => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(undefined)}
                onClick={handleClick}
              >
                {data.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.fill}
                    stroke={entry.fill}
                    strokeWidth={filters.riskLevel.includes(entry.name as RiskLevel) ? 2 : 0}
                    opacity={
                      filters.riskLevel.length === 0 || filters.riskLevel.includes(entry.name as RiskLevel) ? 1 : 0.35
                    }
                  />
                ))}
              </FlexPie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="mt-3 space-y-2">
          {data.map((entry) => (
            <button
              key={entry.name}
              onClick={() => handleClick(entry)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: entry.fill }} />
                <span className="text-muted-foreground">{entry.name}</span>
              </div>
              <span className="font-semibold tabular-nums">{entry.value.toLocaleString()}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
