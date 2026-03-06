import ContainersTable from "@/components/features/ContainersTable";
import ContainerDetailModal from "@/components/features/ContainerDetailModal";
import CSVUploader from "@/components/features/CSVUploader";
import { useDashboardStore } from "@/store/dashboardStore";

export default function Containers() {
  const containers = useDashboardStore((s) => s.containers);
  const hasData = containers.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Containers</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Browse, filter and inspect all container declarations
        </p>
      </div>

      <CSVUploader compact />

      {hasData && (
        <>
          <ContainersTable containers={containers} loading={false} />
          <ContainerDetailModal />
        </>
      )}
    </div>
  );
}
