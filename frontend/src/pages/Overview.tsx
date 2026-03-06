import { useEffect, useState } from "react";
import KPICards from "@/components/features/KPICards";
import RiskDonutChart from "@/components/features/RiskDonutChart";
import RiskTimeline from "@/components/features/RiskTimeline";
import ContainersTable from "@/components/features/ContainersTable";
import ContainerDetailModal from "@/components/features/ContainerDetailModal";
import CSVUploader from "@/components/features/CSVUploader";
import LiveMonitorToggle from "@/components/features/LiveMonitorToggle";
import RiskAlertFeed from "@/components/features/RiskAlertFeed";
import type { KPIData, TimelinePoint } from "@/types";
import { useDashboardStore } from "@/store/dashboardStore";
import { deriveKPIs, deriveTimeline } from "@/services/api";

export default function Overview() {
  const containers = useDashboardStore((s) => s.containers);
  const simulationRunning = useDashboardStore((s) => s.simulationRunning);
  const alerts = useDashboardStore((s) => s.riskAlerts);
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);

  useEffect(() => {
    if (containers.length > 0) {
      setKpis(deriveKPIs(containers));
      setTimeline(deriveTimeline(containers));
    } else {
      setKpis(null);
      setTimeline([]);
    }
  }, [containers]);

  const hasData = containers.length > 0;
  const showAlertFeed = simulationRunning || alerts.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          SmartContainer Risk Engine — live risk dashboard
        </p>
      </div>

      <CSVUploader />
      <LiveMonitorToggle />

      {hasData && (
        <>
          <KPICards data={kpis} loading={false} />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <RiskTimeline data={timeline} loading={false} />
            </div>
            <div>
              <RiskDonutChart containers={containers} />
            </div>
          </div>

          {showAlertFeed && <RiskAlertFeed />}

          <ContainersTable containers={containers} loading={false} />
          <ContainerDetailModal />
        </>
      )}

      {/* Show alert feed even before CSV upload when simulation is running */}
      {!hasData && showAlertFeed && <RiskAlertFeed />}
    </div>
  );
}
