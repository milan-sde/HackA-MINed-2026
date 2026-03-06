import { Link, useLocation } from "react-router-dom";
import {
  BarChart3, Container, LayoutDashboard, FileText,
  Settings, ChevronLeft, ChevronRight, Ship, ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "@/store/dashboardStore";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { path: "/", label: "Overview", icon: LayoutDashboard },
  { path: "/containers", label: "Containers", icon: Container },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/inspection", label: "Inspection Queue", icon: ShieldAlert, badge: true },
  { path: "/reports", label: "Reports", icon: FileText },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useDashboardStore();
  const flaggedCount = useDashboardStore((s) => s.flaggedIds.length);
  const location = useLocation();

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col transition-all duration-300 rounded-r-2xl overflow-hidden",
        sidebarCollapsed ? "w-[72px]" : "w-60"
      )}
      style={{
        background: "hsl(var(--sidebar-bg))",
        borderRight: "1px solid hsl(var(--border))",
      }}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20">
          <Ship className="h-5 w-5 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">SmartContainer</p>
            <p className="truncate text-[10px] text-white/60">Risk Engine v2.0</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
        {NAV_ITEMS.map(({ path, label, icon: Icon, badge: showBadge }) => {
          const active = location.pathname === path || (path !== "/" && location.pathname.startsWith(path));
          return (
            <Tooltip key={path} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  to={path}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-blue-900/60 text-white shadow-lg shadow-black/20 border border-blue-700/40"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {!sidebarCollapsed && <span>{label}</span>}
                  {!sidebarCollapsed && showBadge && flaggedCount > 0 && (
                    <Badge className="ml-auto h-5 min-w-[20px] px-1.5 text-[10px] justify-center bg-red-500/80 text-white border-0 hover:bg-red-500">
                      {flaggedCount}
                    </Badge>
                  )}
                  {!sidebarCollapsed && !showBadge && active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  )}
                </Link>
              </TooltipTrigger>
              {sidebarCollapsed && <TooltipContent side="right">{label}</TooltipContent>}
            </Tooltip>
          );
        })}
      </nav>

      {/* Status */}
      {!sidebarCollapsed && (
        <div className="m-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <div className="absolute inset-0 h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <span className="text-xs text-white/90 font-medium">System Online</span>
          </div>
          <p className="mt-1 text-[10px] text-white/50">All services operational</p>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--sidebar-bg))] text-muted-foreground shadow-md hover:shadow-lg hover:text-foreground transition-all z-10 border border-border"
      >
        {sidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  );
}
