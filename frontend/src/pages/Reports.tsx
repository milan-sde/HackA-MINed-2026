import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Table2, Printer } from "lucide-react";
import { useDashboardStore } from "@/store/dashboardStore";
import { deriveAnomalyPatterns } from "@/services/api";
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

  const total = containers.length;
  const critical = containers.filter(c => c.riskLevel === "Critical").length;
  const lowRisk = containers.filter(c => c.riskLevel === "Low Risk").length;
  const clear = containers.filter(c => c.riskLevel === "Clear").length;
  const anomalies = containers.filter(c => c.anomalyFlag).length;
  const avgScore = total > 0 ? (containers.reduce((s, c) => s + c.riskScore, 0) / total).toFixed(1) : "0";
  const maxScore = total > 0 ? Math.max(...containers.map(c => c.riskScore)).toFixed(1) : "0";

  const anomalyPatterns = useMemo(() => deriveAnomalyPatterns(containers), [containers]);

  function exportCSV() {
    if (total === 0) {
      toast.error("No data to export. Upload a CSV first.");
      return;
    }
    setExporting(true);
    const headers = ["ID", "Risk Score", "Risk Level", "Anomaly", "Origin", "Destination", "HS Code", "Declared Value", "Dwell Time"];
    const rows = containers.map(c => [
      c.id, c.riskScore, c.riskLevel, c.anomalyFlag ? "Yes" : "No",
      c.originCountry, c.destinationCountry, c.hsCode,
      c.declaredValue.toFixed(2), c.dwellTimeHours.toFixed(0),
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smartcontainer_report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
    toast.success("CSV exported successfully");
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
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="default"
              className="gap-2"
              onClick={exportCSV}
              disabled={exporting || total === 0}
            >
              <Table2 className="h-4 w-4" />
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => { window.print(); toast.success("Print dialog opened"); }}
            >
              <Printer className="h-4 w-4" />
              Print Report
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => toast.info("PDF export requires server-side rendering")}
            >
              <FileText className="h-4 w-4" />
              Export PDF
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => toast.info("JSON download ready")}
            >
              <Download className="h-4 w-4" />
              Export JSON
            </Button>
          </div>
          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground">
            {total > 0
              ? `CSV export includes all ${total.toLocaleString()} containers with risk scores, anomaly flags, and metadata.`
              : "Upload data to enable exports."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
