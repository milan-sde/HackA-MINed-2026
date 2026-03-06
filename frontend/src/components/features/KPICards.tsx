import { TrendingUp, TrendingDown, Package, AlertTriangle, ShieldAlert, ShieldCheck, Activity, BarChart2 } from "lucide-react";
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
    key: "lowrisk",
    label: "Low Risk",
    icon: ShieldAlert,
    gradient: "from-[#78350f] to-[#F59E0B]",
    tooltip: "Containers classified as Low Risk — monitor or spot-check",
    getValue: (d: KPIData) => formatNumber(d.lowRiskCount),
    getSub: (d: KPIData) => (
      <span className="flex items-center gap-1.5 text-[11px] text-white/80">
        {formatPct(d.lowRiskPct)} of total
      </span>
    ),
  },
  {
    key: "clear",
    label: "Clear",
    icon: ShieldCheck,
    gradient: "from-[#064e3b] to-[#10B981]",
    tooltip: "Containers classified as Clear — safe for auto-release",
    getValue: (d: KPIData) => formatNumber(d.clearCount),
    getSub: (d: KPIData) => (
      <span className="flex items-center gap-1.5 text-[11px] text-white/80">
        {formatPct(d.clearPct)} of total
      </span>
    ),
  },
  {
    key: "anomaly",
    label: "Anomalies Detected",
    icon: Activity,
    gradient: "from-[#4a1d96] to-[#8B5CF6]",
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
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
      {CARD_DEFS.map((def) => {
        const Icon = def.icon;
        return (
          <Tooltip key={def.key} delayDuration={300}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 cursor-default",
                  def.gradient
                )}
              >
                {/* Decorative circles */}
                <div className="absolute -top-4 -right-4 h-24 w-24 rounded-full bg-white/10" />
                <div className="absolute -bottom-6 -right-6 h-20 w-20 rounded-full bg-white/5" />

                {loading || !data ? (
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-20 !bg-white/20" />
                    <Skeleton className="h-7 w-14 !bg-white/20" />
                    <Skeleton className="h-3 w-24 !bg-white/20" />
                  </div>
                ) : (
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold text-white/80 uppercase tracking-wider">
                        {def.label}
                      </p>
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                        <Icon className="h-4 w-4 text-white" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-white mb-0.5">
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
