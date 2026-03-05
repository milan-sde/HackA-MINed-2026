import { Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useDashboardStore } from "@/store/dashboardStore";
import { useEffect } from "react";
import { subscribeToRealtime } from "@/data/dataService";
import { toast } from "sonner";

interface LayoutProps {
  title?: string;
  subtitle?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function Layout({ title = "SmartContainer Risk Engine", subtitle, onRefresh, isRefreshing }: LayoutProps) {
  const { theme, realtimeEnabled, addRealtimeContainer } = useDashboardStore();

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    if (theme === "light") document.documentElement.classList.add("light");
  }, [theme]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!realtimeEnabled) return;
    const unsub = subscribeToRealtime((container) => {
      addRealtimeContainer(container);
      if (container.riskLevel === "Critical") {
        toast.error(`🚨 Critical container detected`, {
          description: `${container.id} – Risk score: ${container.riskScore}`,
        });
      }
    });
    return unsub;
  }, [realtimeEnabled, addRealtimeContainer]);

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
