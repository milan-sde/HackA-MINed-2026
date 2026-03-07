import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Table2, AlertTriangle as AlertTriangleIcon } from "lucide-react";
import { useDashboardStore } from "@/store/dashboardStore";
import { deriveAnomalyPatterns } from "@/services/api";
import { exportContainersCSV } from "@/lib/export";
import { cn } from "@/lib/utils";
import type { RiskLevel } from "@/types";
import { toast } from "sonner";

function StatRow({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${highlight ? "text-red-400" : ""}`}>{value}</span>
    </div>
  );
}

export default function Reports() {
  const containers = useDashboardStore((s) => s.containers);
  const [exporting, setExporting] = useState(false);
  const [exportRiskFilter, setExportRiskFilter] = useState<RiskLevel[]>([]);
  const [exportAnomalyOnly, setExportAnomalyOnly] = useState(false);

  const total = containers.length;
  const critical = containers.filter(c => c.riskLevel === "Critical").length;
  const lowRisk = containers.filter(c => c.riskLevel === "Low Risk").length;
  const clear = containers.filter(c => c.riskLevel === "Clear").length;
  const anomalies = containers.filter(c => c.anomalyFlag).length;
  const avgScore = total > 0 ? (containers.reduce((s, c) => s + c.riskScore, 0) / total).toFixed(1) : "0";
  const maxScore = total > 0 ? Math.max(...containers.map(c => c.riskScore)).toFixed(1) : "0";

  const anomalyPatterns = useMemo(() => deriveAnomalyPatterns(containers), [containers]);

  const exportOpts = {
    riskLevels: exportRiskFilter.length > 0 ? exportRiskFilter : undefined,
    anomalyOnly: exportAnomalyOnly,
    filenamePrefix: "smartcontainer_report",
  };

  // Preview how many containers match current filter
  const exportPreviewCount = useMemo(() => {
    let result = containers;
    if (exportRiskFilter.length > 0) result = result.filter((c) => exportRiskFilter.includes(c.riskLevel));
    if (exportAnomalyOnly) result = result.filter((c) => c.anomalyFlag);
    return result.length;
  }, [containers, exportRiskFilter, exportAnomalyOnly]);

  function handleExportCSV() {
    if (total === 0) { toast.error("No data to export. Upload a CSV first."); return; }
    setExporting(true);
    const count = exportContainersCSV(containers, exportOpts);
    setExporting(false);
    if (count > 0) toast.success(`CSV exported — ${count.toLocaleString()} containers`);
    else toast.warning("No containers match the selected filters");
  }

  function toggleExportRisk(level: RiskLevel) {
    setExportRiskFilter((prev) =>
      prev.includes(level) ? prev.filter((x) => x !== level) : [...prev, level]
    );
  }

  const safePct = (n: number) => total > 0 ? ((n / total) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Generate and export risk assessment reports</p>
      </div>

      {total === 0 && (
        <Card className="border-dashed border-2">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Upload a CSV on the Overview page to generate reports from live predictions.
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Risk Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <StatRow label="Total Containers" value={total} />
            <StatRow label="Critical Risk" value={`${critical} (${safePct(critical)}%)`} highlight />
            <StatRow label="Low Risk" value={`${lowRisk} (${safePct(lowRisk)}%)`} />
            <StatRow label="Clear" value={`${clear} (${safePct(clear)}%)`} />
            <StatRow label="Anomaly Flagged" value={`${anomalies} (${safePct(anomalies)}%)`} highlight />
            <StatRow label="Avg Risk Score" value={avgScore} />
            <StatRow label="Peak Risk Score" value={maxScore} highlight />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Anomaly Pattern Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {anomalyPatterns.length === 0 && (
              <p className="text-sm text-muted-foreground">No anomaly patterns to show.</p>
            )}
            {anomalyPatterns.map(p => (
              <div key={p.pattern} className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.pattern}</p>
                  <p className="text-xs text-muted-foreground">{p.count} containers</p>
                </div>
                <Badge variant={p.avgRisk >= 70 ? "critical" : p.avgRisk >= 30 ? "lowrisk" : "clear"}>
                  {p.avgRisk.toFixed(0)}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Risk-level filter for export */}
          {total > 0 && (
            <div className="space-y-3">
              <span className="text-xs text-muted-foreground font-medium">Filter export by risk level:</span>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 p-1">
                  {([
                    { level: "Critical" as RiskLevel, color: "#EF4444", activeBg: "bg-red-500/20", activeText: "text-red-400", activeBorder: "border-red-500/40", count: critical },
                    { level: "Low Risk" as RiskLevel, color: "#F59E0B", activeBg: "bg-amber-500/20", activeText: "text-amber-400", activeBorder: "border-amber-500/40", count: lowRisk },
                    { level: "Clear" as RiskLevel, color: "#10B981", activeBg: "bg-emerald-500/20", activeText: "text-emerald-400", activeBorder: "border-emerald-500/40", count: clear },
                  ]).map(({ level, color, activeBg, activeText, activeBorder, count: levelCount }) => {
                    const isActive = exportRiskFilter.includes(level);
                    return (
                      <button
                        key={level}
                        onClick={() => toggleExportRisk(level)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all duration-150",
                          isActive
                            ? `${activeBg} ${activeText} ${activeBorder} border shadow-sm`
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent"
                        )}
                      >
                        <div
                          className={cn("h-2.5 w-2.5 rounded-full transition-all", isActive && "ring-2 ring-offset-1 ring-offset-background")}
                          style={{ background: color, boxShadow: isActive ? `0 0 6px ${color}60` : undefined }}
                        />
                        {level}
                        <span className={cn(
                          "ml-0.5 min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-none",
                          isActive ? `${activeBg} ${activeText}` : "bg-muted text-muted-foreground"
                        )}>
                          {levelCount}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setExportAnomalyOnly((v) => !v)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-all duration-150",
                    exportAnomalyOnly
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border-border"
                  )}
                >
                  <AlertTriangleIcon className="h-3 w-3" />
                  Anomaly Only
                  <span className={cn(
                    "ml-0.5 min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-none",
                    exportAnomalyOnly ? "bg-amber-500/20 text-amber-400" : "bg-muted text-muted-foreground"
                  )}>
                    {anomalies}
                  </span>
                </button>

                {(exportRiskFilter.length > 0 || exportAnomalyOnly) && (
                  <button
                    onClick={() => { setExportRiskFilter([]); setExportAnomalyOnly(false); }}
                    className="rounded-md px-2.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              variant="default"
              size="lg"
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md shadow-emerald-500/20 px-6"
              onClick={handleExportCSV}
              disabled={exporting || total === 0}
            >
              <Table2 className="h-5 w-5" />
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
          </div>
          <Separator className="my-2" />
          <p className="text-xs text-muted-foreground">
            {total > 0
              ? `${exportPreviewCount.toLocaleString()} of ${total.toLocaleString()} containers will be exported${exportRiskFilter.length > 0 ? ` (filtered: ${exportRiskFilter.join(", ")})` : ""}${exportAnomalyOnly ? " — anomaly only" : ""}.`
              : "Upload data to enable exports."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
