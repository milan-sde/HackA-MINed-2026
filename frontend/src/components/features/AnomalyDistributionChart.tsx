import { useMemo } from "react";
import { Scale, Clock, DollarSign, UserX, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Container } from "@/types";
import { deriveAnomalyDistribution, type AnomalyType } from "@/services/api";
import { cn } from "@/lib/utils";

interface Props {
  containers: Container[];
}

const DRIVER_META: Record<
  string,
  { icon: typeof Scale; color: string; bg: string; action: string }
> = {
  weight_mismatch: {
    icon: Scale,
    color: "#EF4444",
    bg: "bg-red-500/10",
    action: "Verify cargo weight",
  },
  dwell_time: {
    icon: Clock,
    color: "#F59E0B",
    bg: "bg-amber-500/10",
    action: "Check clearance delays",
  },
  value_anomaly: {
    icon: DollarSign,
    color: "#8B5CF6",
    bg: "bg-purple-500/10",
    action: "Verify cargo valuation",
  },
  exporter_risk: {
    icon: UserX,
    color: "#F97316",
    bg: "bg-orange-500/10",
    action: "Review exporter history",
  },
};

export default function AnomalyDistributionChart({ containers }: Props) {
  const distribution = useMemo(
    () => deriveAnomalyDistribution(containers),
    [containers],
  );

  const total = useMemo(
    () => distribution.reduce((s, d) => s + d.count, 0),
    [distribution],
  );

  if (distribution.length === 0) return null;

  const maxCount = Math.max(...distribution.map((d) => d.count));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold tracking-tight">
              Top Risk Drivers
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {total} flagged containers by anomaly type
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {distribution.map((d) => {
          const meta = DRIVER_META[d.type];
          if (!meta) return null;
          const Icon = meta.icon;
          const pct = total > 0 ? (d.count / total) * 100 : 0;
          const barWidth = maxCount > 0 ? (d.count / maxCount) * 100 : 0;

          return (
            <div
              key={d.type}
              className="rounded-xl border border-border p-3 transition-colors hover:bg-accent/30"
            >
              {/* Top row: icon, name, count, percentage */}
              <div className="flex items-center gap-3 mb-2.5">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    meta.bg,
                  )}
                >
                  <Icon className="h-4.5 w-4.5" style={{ color: meta.color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-none">{d.label}</p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums" style={{ color: meta.color }}>
                    {d.count.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    {pct.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden mb-2.5">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    background: meta.color,
                    opacity: 0.8,
                  }}
                />
              </div>

              {/* Recommended action */}
              <div className="flex items-center gap-1.5">
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground">
                  {meta.action}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
