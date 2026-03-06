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
        "relative flex h-full flex-col border-r border-border bg-card transition-all duration-300",
        sidebarCollapsed ? "w-16" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Ship className="h-5 w-5 text-primary" />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">SmartContainer</p>
            <p className="truncate text-[10px] text-muted-foreground">Risk Engine v2.0</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 p-2 flex-1">
        {NAV_ITEMS.map(({ path, label, icon: Icon, badge: showBadge }) => {
          const active = location.pathname === path || (path !== "/" && location.pathname.startsWith(path));
          return (
            <Tooltip key={path} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  to={path}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  {!sidebarCollapsed && <span>{label}</span>}
                  {!sidebarCollapsed && showBadge && flaggedCount > 0 && (
                    <Badge variant="destructive" className="ml-auto h-5 min-w-[20px] px-1.5 text-[10px] justify-center">
                      {flaggedCount}
                    </Badge>
                  )}
                  {!sidebarCollapsed && !showBadge && active && (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
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
        <div className="m-2 rounded-lg bg-green-500/10 border border-green-500/20 p-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <div className="absolute inset-0 h-2 w-2 rounded-full bg-green-500 animate-ping" />
            </div>
            <span className="text-xs text-green-400 font-medium">System Online</span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">All services operational</p>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground transition-colors z-10"
      >
        {sidebarCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  );
}
