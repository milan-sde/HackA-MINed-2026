import { Outlet } from "react-router-dom";
import { Toaster, toast } from "sonner";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useDashboardStore } from "@/store/dashboardStore";
import { useEffect } from "react";
import { fetchContainersFromAPI, fetchFlaggedContainers } from "@/services/api";

interface LayoutProps {
  title?: string;
  subtitle?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function Layout({ title = "SmartContainer Risk Engine", subtitle, onRefresh, isRefreshing }: LayoutProps) {
  const { theme } = useDashboardStore();
  const initialLoadDone = useDashboardStore((s) => s.initialLoadDone);
  const containers = useDashboardStore((s) => s.containers);

  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    if (theme === "light") document.documentElement.classList.add("light");
  }, [theme]);

  // Auto-load containers + flagged list on first mount
  useEffect(() => {
    if (initialLoadDone) return;
    if (containers.length > 0) {
      useDashboardStore.getState().setInitialLoadDone();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [loaded, flagged] = await Promise.all([
          fetchContainersFromAPI(),
          fetchFlaggedContainers(),
        ]);
        if (cancelled) return;

        if (loaded.length > 0) {
          const store = useDashboardStore.getState();
          store.setApiData(loaded, {
            total_containers: loaded.length,
            critical_count: loaded.filter((c) => c.riskLevel === "Critical").length,
            low_risk_count: loaded.filter((c) => c.riskLevel === "Low Risk").length,
            clear_count: loaded.filter((c) => c.riskLevel === "Clear").length,
          });
          toast.success(`Loaded ${loaded.length.toLocaleString()} containers`, {
            description: "Data restored from previous predictions",
          });
        }

        if (flagged.length > 0) {
          useDashboardStore.getState().setFlaggedContainers(flagged);
        }
      } catch {
        // Backend may not be running or no predictions yet — silent
      } finally {
        if (!cancelled) {
          useDashboardStore.getState().setInitialLoadDone();
        }
      }
    })();
    return () => { cancelled = true; };
  }, [initialLoadDone, containers.length]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} subtitle={subtitle} onRefresh={onRefresh} isRefreshing={isRefreshing} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <Toaster richColors theme={theme} position="bottom-right" />
    </div>
  );
}
