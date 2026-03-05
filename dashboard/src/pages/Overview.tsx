import { useEffect, useState } from "react";
import KPICards from "@/components/dashboard/KPICards";
import RiskDonutChart from "@/components/dashboard/RiskDonutChart";
import RiskTimeline from "@/components/dashboard/RiskTimeline";
import ContainersTable from "@/components/dashboard/ContainersTable";
import ContainerDetailModal from "@/components/dashboard/ContainerDetailModal";
import type { KPIData, Container, TimelinePoint } from "@/types";
import { fetchKPIs, fetchContainers, fetchTimeline } from "@/data/dataService";

export default function Overview() {
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchKPIs(), fetchContainers(), fetchTimeline()]).then(([k, c, t]) => {
      setKpis(k);
      setContainers(c);
      setTimeline(t);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">SmartContainer Risk Engine — live risk dashboard</p>
      </div>

      <KPICards data={kpis} loading={loading} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <RiskTimeline data={timeline} loading={loading} />
        </div>
        <div>
          <RiskDonutChart containers={containers} />
        </div>
      </div>

      <ContainersTable containers={containers} loading={loading} />
      <ContainerDetailModal />
    </div>
  );
}
