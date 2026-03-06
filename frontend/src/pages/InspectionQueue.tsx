import { useEffect, useState, useCallback } from "react";
import {
  ShieldAlert, RefreshCw, Clock,
  AlertTriangle, Eye, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardStore } from "@/store/dashboardStore";
import { fetchFlaggedContainers, type FlaggedContainer } from "@/services/api";
import { cn, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import ContainerDetailModal from "@/components/features/ContainerDetailModal";

function riskBadge(score: number | null) {
  if (score === null) return <Badge variant="outline">N/A</Badge>;
  if (score >= 70) return <Badge variant="destructive">{score.toFixed(1)}</Badge>;
  if (score >= 30)
    return (
      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30">
        {score.toFixed(1)}
      </Badge>
    );
  return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
      {score.toFixed(1)}
    </Badge>
  );
}

export default function InspectionQueue() {
  const flaggedContainers = useDashboardStore((s) => s.flaggedContainers);
  const setFlaggedContainers = useDashboardStore((s) => s.setFlaggedContainers);
  const containers = useDashboardStore((s) => s.containers);
  const openModal = useDashboardStore((s) => s.openModal);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFlaggedContainers();
      setFlaggedContainers(data);
    } catch {
      toast.error("Failed to load inspection queue");
    }
    setLoading(false);
  }, [setFlaggedContainers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleView(fc: FlaggedContainer) {
    const container = containers.find((c) => c.id === String(fc.container_id));
    if (container) {
      openModal(container);
    } else {
      // Container not in store (e.g. flagged before this session loaded) —
      // build a minimal stub so the modal can still open.
      openModal({
        id: String(fc.container_id),
        riskScore: fc.risk_score ?? 0,
        riskLevel:
          (fc.risk_score ?? 0) >= 70
            ? "Critical"
            : (fc.risk_score ?? 0) >= 30
              ? "Low Risk"
              : "Clear",
        anomalyFlag: false,
        originCountry: "",
        originFlag: "",
        destinationCountry: "",
        destinationPort: "",
        hsCode: "",
        hsChapter: 0,
        declaredValue: 0,
        declaredWeight: 0,
        measuredWeight: 0,
        weightDiscrepancyPct: 0,
        dwellTimeHours: 0,
        importerId: "",
        exporterId: "",
        declarationDate: new Date().toISOString().split("T")[0],
        tradeRegime: "Import",
        explanation: fc.note || "No explanation available.",
        keyRiskFactors: [],
        featureScores: {
          weightDiscrepancy: 0,
          valueRatio: 0,
          dwellTime: 0,
          routeRisk: 0,
          entityHistory: 0,
        },
      });
    }
  }

  const criticalCount = flaggedContainers.filter(
    (f) => f.risk_score !== null && f.risk_score >= 70,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inspection Queue</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Containers flagged for physical inspection by customs officers
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E3A8A] to-[#1d4ed8] p-5 shadow-lg">
          <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-white/10" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <ShieldAlert className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-white">
                {formatNumber(flaggedContainers.length)}
              </p>
              <p className="text-xs text-white/70">Total Flagged</p>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#7f1d1d] to-[#EF4444] p-5 shadow-lg">
          <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-white/10" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-white">
                {formatNumber(criticalCount)}
              </p>
              <p className="text-xs text-white/70">Critical Risk</p>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#164e63] to-[#06B6D4] p-5 shadow-lg">
          <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-white/10" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-white">
                {formatNumber(flaggedContainers.filter((f) => f.status === "flagged").length)}
              </p>
              <p className="text-xs text-white/70">Pending Review</p>
            </div>
          </div>
        </div>
      </div>

      {/* Queue table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Flagged Containers</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : flaggedContainers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldAlert className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">No containers flagged yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Flag containers from the container detail modal to add them here
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left py-2.5 px-3 font-medium">Container ID</th>
                    <th className="text-left py-2.5 px-3 font-medium">Risk Score</th>
                    <th className="text-left py-2.5 px-3 font-medium">Timestamp</th>
                    <th className="text-left py-2.5 px-3 font-medium">Note</th>
                    <th className="text-left py-2.5 px-3 font-medium">Status</th>
                    <th className="text-right py-2.5 px-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {flaggedContainers.map((fc, i) => (
                    <tr
                      key={`${fc.container_id}-${i}`}
                      className="border-b border-border/50 hover:bg-accent/50 transition-colors"
                    >
                      <td className="py-3 px-3 font-mono font-medium">
                        {fc.container_id}
                      </td>
                      <td className="py-3 px-3">
                        {riskBadge(fc.risk_score)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(fc.timestamp).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-3 max-w-[250px]">
                        <p className="text-xs text-muted-foreground truncate">
                          {fc.note || "—"}
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            fc.status === "flagged"
                              ? "border-amber-500/30 text-amber-400"
                              : "border-emerald-500/30 text-emerald-400",
                          )}
                        >
                          {fc.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 h-7 text-xs"
                          onClick={() => handleView(fc)}
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <ContainerDetailModal />
    </div>
  );
}
