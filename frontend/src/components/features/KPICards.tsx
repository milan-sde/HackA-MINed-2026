import { TrendingUp, TrendingDown, Package, AlertTriangle, Activity, BarChart2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatNumber, formatPct } from "@/lib/utils";
import type { KPIData } from "@/types";
import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts";

interface KPICardsProps {
  data: KPIData | null;
  loading?: boolean;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} />;
}

function TrendBadge({ value }: { value: number }) {
  const up = value > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", up ? "text-red-400" : "text-green-400")}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function GaugeMini({ value }: { value: number }) {
  const color = value >= 70 ? "#ff4b4b" : value >= 40 ? "#ffa64b" : "#4bff4b";
  const data = [{ value, fill: color }];
  return (
    <div className="h-12 w-12">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          data={data}
          startAngle={200}
          endAngle={-20}
          innerRadius="65%"
          outerRadius="100%"
          barSize={6}
        >
          <RadialBar dataKey="value" cornerRadius={3} background={{ fill: "hsl(var(--muted))" }} />
        </RadialBarChart>
      </ResponsiveContainer>
    </div>
  );
}

const CARD_DEFS = [
  {
    key: "total",
    label: "Total Containers",
    icon: Package,
    iconBg: "bg-blue-500/10 text-blue-400",
    tooltip: "Total containers processed in the current period",
    getValue: (d: KPIData) => formatNumber(d.totalContainers),
    getSub: (d: KPIData) => <TrendBadge value={d.trend.total} />,
  },
  {
    key: "critical",
    label: "Critical Risk",
    icon: AlertTriangle,
    iconBg: "bg-red-500/10 text-red-400",
    tooltip: "Containers classified as Critical risk requiring immediate inspection",
    getValue: (d: KPIData) => formatNumber(d.criticalCount),
    getSub: (d: KPIData) => (
      <span className="text-xs text-muted-foreground">
        {formatPct(d.criticalPct)} of total · <TrendBadge value={d.trend.critical} />
      </span>
    ),
  },
  {
    key: "anomaly",
    label: "Anomalies Detected",
    icon: Activity,
    iconBg: "bg-orange-500/10 text-orange-400",
    tooltip: "Containers flagged as anomalous by Isolation Forest or rule-based engine",
    getValue: (d: KPIData) => formatNumber(d.anomalyCount),
    getSub: (d: KPIData) => (
      <span className="text-xs text-muted-foreground">
        {formatPct(d.anomalyRate)} detection rate · <TrendBadge value={d.trend.anomaly} />
      </span>
    ),
  },
  {
    key: "avgscore",
    label: "Avg Risk Score",
    icon: BarChart2,
    iconBg: "bg-purple-500/10 text-purple-400",
    tooltip: "Mean ensemble risk score across all containers (0–100)",
    getValue: (d: KPIData) => d.avgRiskScore.toFixed(1),
    getSub: (d: KPIData) => <TrendBadge value={d.trend.avgScore} />,
    extra: (d: KPIData) => <GaugeMini value={d.avgRiskScore} />,
  },
] as const;

export default function KPICards({ data, loading }: KPICardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {CARD_DEFS.map((def) => {
        const Icon = def.icon;
        return (
          <Tooltip key={def.key} delayDuration={300}>
            <TooltipTrigger asChild>
              <Card className="group cursor-default transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5">
                <CardContent className="p-5">
                  {loading || !data ? (
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {def.label}
                        </p>
                        <p className="text-2xl font-bold tabular-nums">{def.getValue(data)}</p>
                        <div className="flex items-center gap-1">{def.getSub(data)}</div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", def.iconBg)}>
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        {"extra" in def && def.extra(data)}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">{def.tooltip}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
