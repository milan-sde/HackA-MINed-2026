import { useState, useEffect } from "react";
import {
  Bell, RefreshCw, Sun, Moon, Download, ChevronDown,
  User, LogOut, Settings, Clock,
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

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function Header({ title, subtitle, onRefresh, isRefreshing }: HeaderProps) {
  const { theme, toggleTheme, notificationCount, clearNotifications } = useDashboardStore();
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    const int = setInterval(() => setLastUpdated(new Date()), 30000);
    return () => clearInterval(int);
  }, []);

  function handleRefresh() {
    setLastUpdated(new Date());
    onRefresh?.();
    toast.success("Data refreshed", { description: "All data has been updated." });
  }

  function handleExport(format: string) {
    toast.info(`Exporting as ${format}...`, { description: "Your download will start shortly." });
  }

  const timeStr = lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <header className="flex h-16 items-center gap-4 border-b border-border bg-card/50 backdrop-blur-sm px-6">
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
          <Button variant="ghost" size="icon" className="relative" onClick={clearNotifications}>
            <Bell className="h-4 w-4" />
            {notificationCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-red-500 text-white border-0 rounded-full">
                {notificationCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notifications</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={clearNotifications}>
              Mark all read
            </Button>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="flex flex-col items-start gap-0.5 p-3">
            <p className="text-sm font-medium">🚨 3 Critical containers flagged</p>
            <p className="text-xs text-muted-foreground">Weight discrepancy &gt;30% detected</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">2 min ago</p>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex flex-col items-start gap-0.5 p-3">
            <p className="text-sm font-medium">⚠️ High dwell time alert</p>
            <p className="text-xs text-muted-foreground">CTR14563892 exceeded 120 hrs</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">15 min ago</p>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex flex-col items-start gap-0.5 p-3">
            <p className="text-sm font-medium">📊 Model retrained successfully</p>
            <p className="text-xs text-muted-foreground">F1 score improved to 0.847</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">1 hr ago</p>
          </DropdownMenuItem>
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
          <DropdownMenuItem className="text-red-400"><LogOut className="h-4 w-4 mr-2" />Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
