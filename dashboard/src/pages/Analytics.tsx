import { useEffect, useState } from "react";
import AnomalySection from "@/components/dashboard/AnomalySection";
import EntityPanel from "@/components/dashboard/EntityPanel";
import RiskTimeline from "@/components/dashboard/RiskTimeline";
import type { Container, TimelinePoint } from "@/types";
import { fetchContainers, fetchTimeline } from "@/data/dataService";

export default function Analytics() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchContainers(), fetchTimeline()]).then(([c, t]) => {
      setContainers(c);
      setTimeline(t);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Anomaly patterns, entity risk, and trend analysis</p>
      </div>
      <RiskTimeline data={timeline} loading={loading} />
      <AnomalySection containers={containers} />
      <EntityPanel />
    </div>
  );
}
