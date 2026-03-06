import { useEffect, useRef } from "react";
import {
  ShieldAlert,
  X,
  Trash2,
  MapPin,
  BrainCircuit,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardStore } from "@/store/dashboardStore";
import { cn } from "@/lib/utils";

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

export default function RiskAlertFeed() {
  const alerts = useDashboardStore((s) => s.riskAlerts);
  const dismissAlert = useDashboardStore((s) => s.dismissAlert);
  const clearAlerts = useDashboardStore((s) => s.clearAlerts);
  const openModal = useDashboardStore((s) => s.openModal);
  const containers = useDashboardStore((s) => s.containers);
  const running = useDashboardStore((s) => s.simulationRunning);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [alerts.length]);

  if (!running && alerts.length === 0) return null;

  function handleClickAlert(containerId: string) {
    const container = containers.find((c) => c.id === containerId);
    if (container) openModal(container);
  }

  return (
    <Card className="border-red-500/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-400" />
            <CardTitle className="text-sm font-semibold">
              Risk Alerts
            </CardTitle>
            {alerts.length > 0 && (
              <Badge
                variant="destructive"
                className="h-5 px-1.5 text-[10px]"
              >
                {alerts.length}
              </Badge>
            )}
            {running && (
              <div className="flex items-center gap-1.5 ml-1">
                <div className="relative">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  <div className="absolute inset-0 h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                </div>
                <span className="text-[10px] text-red-400 font-medium">
                  LIVE
                </span>
              </div>
            )}
          </div>
          {alerts.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-muted-foreground"
              onClick={clearAlerts}
            >
              <Trash2 className="h-3 w-3" />
              Clear all
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
            <span>
              {running
                ? "Monitoring... alerts will appear when critical containers are detected"
                : "No active alerts"}
            </span>
          </div>
        ) : (
          <div
            ref={feedRef}
            className="space-y-2 max-h-[320px] overflow-y-auto pr-1"
          >
            {alerts.map((alert, i) => (
              <div
                key={alert.id}
                className={cn(
                  "group relative flex items-start gap-3 rounded-lg border p-3 cursor-pointer",
                  "transition-all duration-300 hover:bg-accent/50",
                  i === 0 && "animate-in slide-in-from-top-2 fade-in duration-300",
                  alert.riskLevel === "Critical"
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-orange-500/30 bg-orange-500/5",
                )}
                onClick={() => handleClickAlert(alert.containerId)}
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    alert.riskLevel === "Critical"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-orange-500/20 text-orange-400",
                  )}
                >
                  <ShieldAlert className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold">
                      Container {alert.containerId}
                    </span>
                    <Badge
                      variant="destructive"
                      className="h-4 px-1 text-[9px]"
                    >
                      {alert.riskScore.toFixed(1)}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                      {timeAgo(alert.timestamp)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>Origin: {alert.origin}</span>
                  </div>

                  <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <BrainCircuit className="h-3 w-3 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{alert.explanation}</span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissAlert(alert.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
