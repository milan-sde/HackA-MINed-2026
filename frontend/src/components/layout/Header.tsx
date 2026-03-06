import { useState, useEffect, useCallback } from "react";
import {
  Bell, RefreshCw, Sun, Moon, Download, ChevronDown,
  User, LogOut, Settings, Clock, AlertTriangle, CheckCircle2,
  Info, Siren,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDashboardStore } from "@/store/dashboardStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  fetchNotifications,
  markNotificationsRead,
  fetchUnreadCount,
  type Notification,
} from "@/services/api";

/* ---- helpers ---- */

const NOTIFICATION_ICONS: Record<string, typeof AlertTriangle> = {
  critical: Siren,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};
const NOTIFICATION_COLORS: Record<string, string> = {
  critical: "text-red-500",
  warning: "text-yellow-500",
  success: "text-green-500",
  info: "text-blue-500",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotificationItem({ notification: n }: { notification: Notification }) {
  const Icon = NOTIFICATION_ICONS[n.type] ?? Info;
  const color = NOTIFICATION_COLORS[n.type] ?? "text-muted-foreground";
  return (
    <DropdownMenuItem className={cn("flex items-start gap-2.5 p-3", !n.is_read && "bg-muted/40")}>
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", color)} />
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-sm font-medium leading-tight">{n.title}</p>
        <p className="text-xs text-muted-foreground truncate">{n.message}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
      </div>
    </DropdownMenuItem>
  );
}

/* ---- main component ---- */

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function Header({ title, subtitle, onRefresh, isRefreshing }: HeaderProps) {
  const { theme, toggleTheme, notificationCount, clearNotifications, notifications, setNotifications, setNotificationCount } = useDashboardStore();
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const loadNotifications = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        fetchNotifications(),
        fetchUnreadCount(),
      ]);
      setNotifications(list);
      setNotificationCount(count);
    } catch {
      /* backend may not be running — silently ignore */
    }
  }, [setNotifications, setNotificationCount]);

  useEffect(() => {
    loadNotifications();
    const poll = setInterval(loadNotifications, 15_000);
    return () => clearInterval(poll);
  }, [loadNotifications]);

  useEffect(() => {
    const int = setInterval(() => setLastUpdated(new Date()), 30000);
    return () => clearInterval(int);
  }, []);

  async function handleMarkRead() {
    try {
      await markNotificationsRead();
      // immediately reflect in UI, then re-fetch to sync
      setNotificationCount(0);
      setNotifications(notifications.map((n) => ({ ...n, is_read: true })));
      await loadNotifications();
    } catch {
      setNotificationCount(0);
    }
  }

  function handleRefresh() {
    setLastUpdated(new Date());
    onRefresh?.();
    loadNotifications();
    toast.success("Data refreshed", { description: "All data has been updated." });
  }

  function handleExport(format: string) {
    toast.info(`Exporting as ${format}...`, { description: "Your download will start shortly." });
  }

  const timeStr = lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <header className="flex h-16 items-center gap-4 border-b border-border/60 bg-card px-8">
      {/* Title area */}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold truncate">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>

      {/* Last updated */}
      <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>Updated {timeStr}</span>
      </div>

      {/* Refresh */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Refresh data</TooltipContent>
      </Tooltip>

      {/* Export */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Export Options</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleExport("CSV")}>
            <Download className="h-4 w-4 mr-2" />Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("PDF")}>
            <Download className="h-4 w-4 mr-2" />Export as PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("Print")}>
            <Download className="h-4 w-4 mr-2" />Print Dashboard
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Theme toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Toggle theme</TooltipContent>
      </Tooltip>

      {/* Notifications */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            {notificationCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-red-500 text-white border-0 rounded-full">
                {notificationCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notifications</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={handleMarkRead}>
              Mark all read
            </Button>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <div className="max-h-[320px] overflow-y-auto">
              {notifications.slice(0, 8).map((n) => (
                <NotificationItem key={n.id} notification={n} />
              ))}
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Profile */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
              CA
            </div>
            <span className="hidden md:inline text-sm">Customs Admin</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>
            <p className="font-medium">Customs Admin</p>
            <p className="text-xs text-muted-foreground font-normal">admin@customs.gov</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem><User className="h-4 w-4 mr-2" />Profile</DropdownMenuItem>
          <DropdownMenuItem><Settings className="h-4 w-4 mr-2" />Settings</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-500"><LogOut className="h-4 w-4 mr-2" />Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
