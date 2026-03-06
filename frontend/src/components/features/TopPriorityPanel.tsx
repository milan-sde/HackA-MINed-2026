import { useMemo } from "react";
import {
  ShieldAlert,
  Eye,
  Flag,
  Scale,
  Clock,
  DollarSign,
  UserX,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Container } from "@/types";
import { useDashboardStore } from "@/store/dashboardStore";
import {
  getAnomalyType,
  getRecommendedAction,
  ANOMALY_TYPE_META,
  type AnomalyType,
} from "@/services/api";

interface Props {
  containers: Container[];
}

const ANOMALY_ICONS: Record<AnomalyType, typeof Scale> = {
  weight_mismatch: Scale,
  dwell_time: Clock,
  value_anomaly: DollarSign,
  exporter_risk: UserX,
  normal: ShieldAlert,
};

export default function TopPriorityPanel({ containers }: Props) {
  const openModal = useDashboardStore((s) => s.openModal);
  const flaggedIds = useDashboardStore((s) => s.flaggedIds);

  const topFive = useMemo(
    () =>
      [...containers]
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 5),
    [containers],
  );

  if (topFive.length === 0) return null;

  return (
    <Card className="border-red-500/40 bg-red-500/[0.03]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15">
            <ShieldAlert className="h-4.5 w-4.5 text-red-400" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold tracking-tight">
              Top Priority Containers
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Highest risk — requires immediate attention
            </p>
          </div>
          <Badge
            variant="destructive"
            className="ml-auto text-[10px] animate-pulse"
          >
            URGENT
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {topFive.map((c, i) => {
          const anomalyType = getAnomalyType(c);
          const meta = ANOMALY_TYPE_META[anomalyType];
          const Icon = ANOMALY_ICONS[anomalyType];
          const action = getRecommendedAction(c);
          const isCritical = c.riskLevel === "Critical";

          return (
            <div
              key={c.id}
              onClick={() => openModal(c)}
              className={cn(
                "group relative flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all",
                "hover:shadow-md hover:-translate-y-px",
                isCritical
                  ? "border-red-500/40 bg-red-500/10 hover:bg-red-500/15"
                  : "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10",
              )}
            >
              {/* Rank */}
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  isCritical
                    ? "bg-red-500 text-white"
                    : "bg-amber-500 text-white",
                )}
              >
                {i + 1}
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold">{c.id}</span>
                  {flaggedIds.includes(c.id) && (
                    <Flag className="h-3 w-3 text-red-400 fill-current" />
                  )}
                  <Badge
                    variant={isCritical ? "critical" : "lowrisk"}
                    className="text-[9px] h-4 px-1.5"
                  >
                    {c.riskLevel}
                  </Badge>
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5"
                    style={{
                      background: `${meta.color}20`,
                      color: meta.color,
                    }}
                  >
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </span>
                </div>

                {/* Risk bar */}
                <div className="flex items-center gap-2">
                  <Progress value={c.riskScore} className="h-2 flex-1" />
                  <span
                    className="text-sm font-bold tabular-nums"
                    style={{ color: isCritical ? "#EF4444" : "#F59E0B" }}
                  >
                    {c.riskScore.toFixed(0)}
                  </span>
                </div>

                {/* Details line */}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>
                    {c.originFlag} {c.originCountry} → {c.destinationCountry}
                  </span>
                  <span>·</span>
                  <span>{c.dwellTimeHours.toFixed(0)}h dwell</span>
                  {c.weightDiscrepancyPct > 10 && (
                    <>
                      <span>·</span>
                      <span className="text-red-400">
                        Δ{c.weightDiscrepancyPct.toFixed(1)}%
                      </span>
                    </>
                  )}
                </div>

                {/* Recommended action */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Action:
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      isCritical ? "text-red-400" : "text-amber-400",
                    )}
                  >
                    {action}
                  </span>
                </div>
              </div>

              {/* View button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-60 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  openModal(c);
                }}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
