import { useEffect, useState } from "react";
import ContainersTable from "@/components/dashboard/ContainersTable";
import ContainerDetailModal from "@/components/dashboard/ContainerDetailModal";
import type { Container } from "@/types";
import { fetchContainers } from "@/data/dataService";

export default function Containers() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContainers().then((c) => { setContainers(c); setLoading(false); });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Containers</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Browse, filter and inspect all container declarations</p>
      </div>
      <ContainersTable containers={containers} loading={loading} />
      <ContainerDetailModal />
    </div>
  );
}
