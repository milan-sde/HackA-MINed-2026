import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDashboardStore } from "@/store/dashboardStore";
import { toast } from "sonner";
import { Moon, Sun, Wifi, WifiOff, RotateCcw } from "lucide-react";

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function Settings() {
  const {
    theme,
    toggleTheme,
    realtimeEnabled,
    toggleRealtime,
    resetFilters,
    filters,
    setFilter,
  } = useDashboardStore();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Configure dashboard behaviour and display preferences</p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingRow
            label="Theme"
            description="Toggle between dark and light appearance"
          >
            <Button variant="outline" size="sm" className="gap-2" onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </Button>
          </SettingRow>
        </CardContent>
      </Card>

      {/* Data */}
      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingRow
            label="Real-time Updates"
            description="Simulate live data ingestion every 5 seconds"
          >
            <Button
              variant={realtimeEnabled ? "destructive" : "default"}
              size="sm"
              className="gap-2"
              onClick={() => {
                toggleRealtime();
                toast(realtimeEnabled ? "Real-time updates paused" : "Real-time updates enabled");
              }}
            >
              {realtimeEnabled ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
              {realtimeEnabled ? "Pause" : "Enable"}
            </Button>
          </SettingRow>
          <SettingRow
            label="Reset Filters"
            description="Clear all active container filters and return to default view"
          >
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => { resetFilters(); toast.success("Filters reset"); }}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </SettingRow>
        </CardContent>
      </Card>

      {/* Risk Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingRow
            label="Minimum Risk Score Filter"
            description={`Currently showing containers above score ${filters.minRiskScore}`}
          >
            <input
              type="range"
              min={0}
              max={90}
              step={5}
              value={filters.minRiskScore}
              onChange={(e) => setFilter("minRiskScore", Number(e.target.value))}
              className="w-32 accent-primary"
            />
            <span className="ml-2 text-sm tabular-nums w-6 text-center">{filters.minRiskScore}</span>
          </SettingRow>
          <SettingRow
            label="Show Anomalies Only"
            description="Only display containers flagged by Isolation Forest"
          >
            <button
              role="switch"
              aria-checked={filters.anomalyOnly}
              onClick={() => setFilter("anomalyOnly", !filters.anomalyOnly)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                filters.anomalyOnly ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
                  filters.anomalyOnly ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </SettingRow>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>SmartContainer Risk Engine — Dashboard v1.0.0</p>
            <p>Model: XGBoost + Isolation Forest ensemble</p>
            <p>Built with React 18, Vite 8, Tailwind CSS v3, Recharts, Zustand</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
