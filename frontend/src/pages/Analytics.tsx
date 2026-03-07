import { useEffect, useState } from "react";
import AnomalySection from "@/components/features/AnomalySection";
import EntityPanel from "@/components/features/EntityPanel";
import RiskTimeline from "@/components/features/RiskTimeline";
import RiskHeatmap from "@/components/features/RiskHeatmap";
import CSVUploader from "@/components/features/CSVUploader";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { TimelinePoint } from "@/types";
import { useDashboardStore } from "@/store/dashboardStore";
import { deriveTimeline } from "@/services/api";
import { exportContainersCSV } from "@/lib/export";
import { toast } from "sonner";

export default function Analytics() {
  const containers = useDashboardStore((s) => s.containers);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const hasData = containers.length > 0;

  useEffect(() => {
    setTimeline(hasData ? deriveTimeline(containers) : []);
  }, [containers, hasData]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Anomaly patterns, entity risk, and trend analysis
          </p>
        </div>
        {hasData && (
          <Button
            size="sm"
            className="gap-2 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/20"
            onClick={() => {
              const count = exportContainersCSV(containers, { filenamePrefix: "analytics_export" });
              if (count > 0) toast.success(`Exported ${count.toLocaleString()} containers`);
              else toast.warning("No data to export");
            }}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        )}
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
