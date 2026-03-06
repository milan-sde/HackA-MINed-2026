import { useEffect, useState } from "react";
import AnomalySection from "@/components/features/AnomalySection";
import EntityPanel from "@/components/features/EntityPanel";
import RiskTimeline from "@/components/features/RiskTimeline";
import RiskHeatmap from "@/components/features/RiskHeatmap";
import CSVUploader from "@/components/features/CSVUploader";
import type { TimelinePoint } from "@/types";
import { useDashboardStore } from "@/store/dashboardStore";
import { deriveTimeline } from "@/services/api";

export default function Analytics() {
  const containers = useDashboardStore((s) => s.containers);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const hasData = containers.length > 0;

  useEffect(() => {
    setTimeline(hasData ? deriveTimeline(containers) : []);
  }, [containers, hasData]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Anomaly patterns, entity risk, and trend analysis
        </p>
      </div>

      <CSVUploader compact />

      {hasData && (
        <>
          <RiskHeatmap containers={containers} />
          <RiskTimeline data={timeline} loading={false} />
          <AnomalySection containers={containers} />
          <EntityPanel />
        </>
      )}
    </div>
  );
}
