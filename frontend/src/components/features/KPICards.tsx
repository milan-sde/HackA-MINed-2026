import { TrendingUp, TrendingDown, Package, AlertTriangle, Activity, BarChart2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatNumber, formatPct } from "@/lib/utils";
import type { KPIData } from "@/types";

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
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full",
      up ? "bg-white/20 text-white" : "bg-white/20 text-white"
    )}>
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}{Math.abs(value).toFixed(1)}%
    </span>
  );
}

const CARD_DEFS = [
  {
    key: "total",
    label: "Total Containers",
    icon: Package,
    gradient: "from-[#1E3A8A] to-[#1d4ed8]",
    tooltip: "Total containers processed in the current period",
    getValue: (d: KPIData) => formatNumber(d.totalContainers),
    getSub: (d: KPIData) => <TrendBadge value={d.trend.total} />,
  },
  {
    key: "critical",
    label: "Critical Risk",
    icon: AlertTriangle,
    gradient: "from-[#7f1d1d] to-[#EF4444]",
    tooltip: "Containers classified as Critical risk requiring immediate inspection",
    getValue: (d: KPIData) => formatNumber(d.criticalCount),
    getSub: (d: KPIData) => (
      <span className="flex items-center gap-1.5 text-[11px] text-white/80">
        {formatPct(d.criticalPct)} of total <TrendBadge value={d.trend.critical} />
      </span>
    ),
  },
  {
    key: "anomaly",
    label: "Anomalies Detected",
    icon: Activity,
    gradient: "from-[#78350f] to-[#F59E0B]",
    tooltip: "Containers flagged as anomalous by Isolation Forest or rule-based engine",
    getValue: (d: KPIData) => formatNumber(d.anomalyCount),
    getSub: (d: KPIData) => (
      <span className="flex items-center gap-1.5 text-[11px] text-white/80">
        {formatPct(d.anomalyRate)} rate <TrendBadge value={d.trend.anomaly} />
      </span>
    ),
  },
  {
    key: "avgscore",
    label: "Avg Risk Score",
    icon: BarChart2,
    gradient: "from-[#164e63] to-[#06B6D4]",
    tooltip: "Mean ensemble risk score across all containers (0-100)",
    getValue: (d: KPIData) => d.avgRiskScore.toFixed(1),
    getSub: (d: KPIData) => <TrendBadge value={d.trend.avgScore} />,
  },
] as const;

export default function KPICards({ data, loading }: KPICardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      {CARD_DEFS.map((def) => {
        const Icon = def.icon;
        return (
          <Tooltip key={def.key} delayDuration={300}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 cursor-default",
                  def.gradient
                )}
              >
                {/* Decorative circles */}
                <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-white/10" />
                <div className="absolute -bottom-6 -right-6 h-20 w-20 rounded-full bg-white/5" />

                {loading || !data ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24 !bg-white/20" />
                    <Skeleton className="h-8 w-16 !bg-white/20" />
                    <Skeleton className="h-3 w-32 !bg-white/20" />
                  </div>
                ) : (
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                        {def.label}
                      </p>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold tabular-nums text-white mb-1">
                      {def.getValue(data)}
                    </p>
                    <div className="flex items-center gap-1">{def.getSub(data)}</div>
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">{def.tooltip}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
