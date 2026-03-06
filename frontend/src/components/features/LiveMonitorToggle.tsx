import { useCallback, useEffect, useRef } from "react";
import { Radio, Pause, Activity, Container, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardStore } from "@/store/dashboardStore";
import { startSimulation, stopSimulation } from "@/services/simulation";
import { cn, formatNumber } from "@/lib/utils";

export default function LiveMonitorToggle() {
  const running = useDashboardStore((s) => s.simulationRunning);
  const simulatedCount = useDashboardStore((s) => s.simulatedCount);
  const containers = useDashboardStore((s) => s.containers);
  const alerts = useDashboardStore((s) => s.riskAlerts);
  const stopRef = useRef(stopSimulation);
  stopRef.current = stopSimulation;

  useEffect(() => {
    return () => {
      stopRef.current();
    };
  }, []);

  const toggle = useCallback(() => {
    if (running) stopSimulation();
    else startSimulation();
  }, [running]);

  const criticalCount = containers.filter((c) => c.riskLevel === "Critical").length;

  return (
    <Card
      className={cn(
        "transition-all duration-500",
        running &&
          "ring-2 ring-primary/40 shadow-lg shadow-primary/10",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Toggle button */}
          <Button
            variant={running ? "destructive" : "default"}
            size="sm"
            onClick={toggle}
            className="gap-2 min-w-[180px]"
          >
            {running ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                Stop Monitoring
              </>
            ) : (
              <>
                <Radio className="h-3.5 w-3.5" />
                Live Monitoring Mode
              </>
            )}
          </Button>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center">
              <div
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  running ? "bg-red-500" : "bg-muted-foreground/40",
                )}
              />
              {running && (
                <div className="absolute h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
              )}
            </div>
            <span
              className={cn(
                "text-xs font-medium",
                running ? "text-red-500" : "text-muted-foreground",
              )}
            >
              {running ? "LIVE" : "PAUSED"}
            </span>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 ml-auto text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              <span>Simulated:</span>
              <span className="font-semibold text-foreground tabular-nums">
                {formatNumber(simulatedCount)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Container className="h-3.5 w-3.5" />
              <span>Total:</span>
              <span className="font-semibold text-foreground tabular-nums">
                {formatNumber(containers.length)}
              </span>
            </div>

            {criticalCount > 0 && (
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
                <span className="text-muted-foreground">Critical:</span>
                <Badge
                  variant="destructive"
                  className="h-5 px-1.5 text-[10px] font-bold"
                >
                  {formatNumber(criticalCount)}
                </Badge>
              </div>
            )}

            {alerts.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Alerts:</span>
                <Badge
                  variant="outline"
                  className="h-5 px-1.5 text-[10px] font-bold border-orange-500/50 text-orange-400"
                >
                  {alerts.length}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Live description */}
        {running && (
          <p className="text-[11px] text-muted-foreground mt-2 pl-1">
            Generating a new container every 3 seconds and scoring it through
            the ML prediction API. Critical containers trigger alerts below.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
