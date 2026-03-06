import { useEffect, useState } from "react";
import KPICards from "@/components/features/KPICards";
import ContainersTable from "@/components/features/ContainersTable";
import ContainerDetailModal from "@/components/features/ContainerDetailModal";
import CSVUploader from "@/components/features/CSVUploader";
import RiskAlertFeed from "@/components/features/RiskAlertFeed";
import TopPriorityPanel from "@/components/features/TopPriorityPanel";
import AnomalyDistributionChart from "@/components/features/AnomalyDistributionChart";
import type { KPIData } from "@/types";
import { useDashboardStore } from "@/store/dashboardStore";
import { deriveKPIs } from "@/services/api";

export default function Overview() {
  const containers = useDashboardStore((s) => s.containers);
  const alerts = useDashboardStore((s) => s.riskAlerts);
  const dataStatus = useDashboardStore((s) => s.dataStatus);
  const [kpis, setKpis] = useState<KPIData | null>(null);

  useEffect(() => {
    if (containers.length > 0) {
      setKpis(deriveKPIs(containers));
    } else {
      setKpis(null);
    }
  }, [containers]);

  const hasData = containers.length > 0;
  const isLoading = dataStatus === "uploading";
  const showAlertFeed = alerts.length > 0;

  return (
    <div className="space-y-6">
      {/* Status banner — slim, informational only */}
      <CSVUploader />

      {/* Loading skeleton state while CSV is being processed */}
      {isLoading && !hasData && (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-muted/60" />
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="h-64 rounded-xl bg-muted/60" />
            <div className="h-64 rounded-xl bg-muted/60" />
          </div>
        </div>
      )}

      {hasData && (
        <>
          <KPICards data={kpis} loading={false} />

          {/* Priority: Top-risk containers + alerts — above the fold */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <TopPriorityPanel containers={containers} />
            {showAlertFeed ? <RiskAlertFeed /> : <AnomalyDistributionChart containers={containers} />}
          </div>

          <ContainersTable containers={containers} loading={false} />
          <ContainerDetailModal />
        </>
      )}

      {/* Empty state when no data and not loading */}
      {!hasData && !isLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-muted p-5 mb-5">
            <svg className="h-10 w-10 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground">No container data loaded</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Click <span className="font-semibold text-blue-400">Upload CSV</span> in the top navigation bar to import container data for risk analysis.
          </p>
        </div>
      )}
    </div>
  );
}
