import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Table2, Printer } from "lucide-react";
import { MOCK_CONTAINERS, MOCK_ANOMALY_PATTERNS } from "@/data/mockData";
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
  const [exporting, setExporting] = useState(false);

  const total = MOCK_CONTAINERS.length;
  const critical = MOCK_CONTAINERS.filter(c => c.riskLevel === "Critical").length;
  const lowRisk = MOCK_CONTAINERS.filter(c => c.riskLevel === "Low Risk").length;
  const clear = MOCK_CONTAINERS.filter(c => c.riskLevel === "Clear").length;
  const anomalies = MOCK_CONTAINERS.filter(c => c.anomalyFlag).length;
  const avgScore = (MOCK_CONTAINERS.reduce((s, c) => s + c.riskScore, 0) / total).toFixed(1);
  const maxScore = Math.max(...MOCK_CONTAINERS.map(c => c.riskScore)).toFixed(1);

  function exportCSV() {
    setExporting(true);
    const headers = ["ID", "Risk Score", "Risk Level", "Anomaly", "Origin", "Destination", "HS Code", "Declared Value", "Dwell Time"];
    const rows = MOCK_CONTAINERS.map(c => [
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Generate and export risk assessment reports</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <StatRow label="Total Containers" value={total} />
            <StatRow label="Critical Risk" value={`${critical} (${((critical / total) * 100).toFixed(1)}%)`} highlight />
            <StatRow label="Low Risk" value={`${lowRisk} (${((lowRisk / total) * 100).toFixed(1)}%)`} />
            <StatRow label="Clear" value={`${clear} (${((clear / total) * 100).toFixed(1)}%)`} />
            <StatRow label="Anomaly Flagged" value={`${anomalies} (${((anomalies / total) * 100).toFixed(1)}%)`} highlight />
            <StatRow label="Avg Risk Score" value={avgScore} />
            <StatRow label="Peak Risk Score" value={maxScore} highlight />
          </CardContent>
        </Card>

        {/* Anomaly Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Anomaly Pattern Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {MOCK_ANOMALY_PATTERNS.map(p => (
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

      {/* Export Controls */}
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
              disabled={exporting}
            >
              <Table2 className="h-4 w-4" />
              {exporting ? "Exporting…" : "Export CSV"}
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
            CSV export includes all {total} containers with risk scores, anomaly flags, and metadata.
            PDF and JSON exports require backend integration.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
