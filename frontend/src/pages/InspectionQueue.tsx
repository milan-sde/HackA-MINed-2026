import { useEffect, useState, useCallback } from "react";
import {
  ShieldAlert, RefreshCw, Clock,
  AlertTriangle, Eye, Loader2, CheckCircle, XCircle, Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardStore } from "@/store/dashboardStore";
import { fetchFlaggedContainers, markContainerUnderReview, markContainerInspected, unflagContainer, type FlaggedContainer } from "@/services/api";
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
  const updateFlaggedStatus = useDashboardStore((s) => s.updateFlaggedStatus);
  const removeFlaggedContainer = useDashboardStore((s) => s.removeFlaggedContainer);
  const containers = useDashboardStore((s) => s.containers);
  const openModal = useDashboardStore((s) => s.openModal);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "flagged" | "under_review" | "inspected">("all");

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

  async function handleStartReview(fc: FlaggedContainer) {
    const cid = String(fc.container_id);
    setActionLoading(cid);
    try {
      await markContainerUnderReview(cid);
      updateFlaggedStatus(cid, "under_review");
      toast.success(`Container ${cid} is now under review`);
    } catch {
      toast.error(`Failed to start review for ${cid}`);
    }
    setActionLoading(null);
  }

  async function handleMarkInspected(fc: FlaggedContainer) {
    const cid = String(fc.container_id);
    setActionLoading(cid);
    try {
      await markContainerInspected(cid);
      updateFlaggedStatus(cid, "inspected");
      toast.success(`Container ${cid} marked as inspected`);
    } catch {
      toast.error(`Failed to mark ${cid} as inspected`);
    }
    setActionLoading(null);
  }

  async function handleUnflag(fc: FlaggedContainer) {
    const cid = String(fc.container_id);
    setActionLoading(cid);
    try {
      await unflagContainer(cid);
      removeFlaggedContainer(cid);
      toast.success(`Container ${cid} removed from queue`);
    } catch {
      toast.error(`Failed to unflag ${cid}`);
    }
    setActionLoading(null);
  }

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
  const flaggedCount = flaggedContainers.filter((f) => f.status === "flagged").length;
  const underReviewCount = flaggedContainers.filter((f) => f.status === "under_review").length;
  const inspectedCount = flaggedContainers.filter((f) => f.status === "inspected").length;

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <p className="text-xs text-white/70">Total Queued</p>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#92400e] to-[#F59E0B] p-5 shadow-lg">
          <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-white/10" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-white">
                {formatNumber(flaggedCount)}
              </p>
              <p className="text-xs text-white/70">Flagged</p>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#164e63] to-[#06B6D4] p-5 shadow-lg">
          <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-white/10" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <Search className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-white">
                {formatNumber(underReviewCount)}
              </p>
              <p className="text-xs text-white/70">Under Review</p>
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#064e3b] to-[#10B981] p-5 shadow-lg">
          <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-white/10" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <CheckCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-white">
                {formatNumber(inspectedCount)}
              </p>
              <p className="text-xs text-white/70">Inspected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Status filter toggle */}
      <div className="flex items-center gap-2">
        {(["all", "flagged", "under_review", "inspected"] as const).map((s) => {
          const label = s === "all" ? "All" : s === "flagged" ? "Flagged" : s === "under_review" ? "Under Review" : "Inspected";
          const count = s === "all" ? flaggedContainers.length : s === "flagged" ? flaggedCount : s === "under_review" ? underReviewCount : inspectedCount;
          const isActive = statusFilter === s;
          return (
            <Button
              key={s}
              variant={isActive ? "default" : "outline"}
              size="sm"
              className={cn(
                "gap-1.5 text-xs h-8",
                isActive && s === "flagged" && "bg-amber-600 hover:bg-amber-700 text-white",
                isActive && s === "under_review" && "bg-blue-600 hover:bg-blue-700 text-white",
                isActive && s === "inspected" && "bg-emerald-600 hover:bg-emerald-700 text-white",
              )}
              onClick={() => setStatusFilter(s)}
            >
              {label}
              <Badge variant="secondary" className={cn("ml-1 h-5 min-w-[20px] px-1.5 text-[10px]", isActive ? "bg-white/20 text-white" : "")}>
                {count}
              </Badge>
            </Button>
          );
        })}
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
          ) : (() => {
            const filtered = statusFilter === "all"
              ? flaggedContainers
              : flaggedContainers.filter((fc) => fc.status === statusFilter);
            return filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium">No containers with status “{statusFilter.replace("_", " ")}”</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try selecting a different filter
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
                  {filtered.map((fc, i) => (
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
                              : fc.status === "under_review"
                                ? "border-blue-500/30 text-blue-400"
                                : fc.status === "inspected"
                                  ? "border-emerald-500/30 text-emerald-400"
                                  : "border-muted-foreground/30 text-muted-foreground",
                          )}
                        >
                          {fc.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 h-7 text-xs"
                            onClick={() => handleView(fc)}
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Button>
                          {fc.status === "flagged" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 h-7 text-xs text-blue-400 hover:text-blue-300"
                              onClick={() => handleStartReview(fc)}
                              disabled={actionLoading === String(fc.container_id)}
                            >
                              {actionLoading === String(fc.container_id) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Search className="h-3 w-3" />
                              )}
                              Review
                            </Button>
                          )}
                          {fc.status === "under_review" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 h-7 text-xs text-emerald-400 hover:text-emerald-300"
                              onClick={() => handleMarkInspected(fc)}
                              disabled={actionLoading === String(fc.container_id)}
                            >
                              {actionLoading === String(fc.container_id) ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3 w-3" />
                              )}
                              Inspected
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 h-7 text-xs text-red-400 hover:text-red-300"
                            onClick={() => handleUnflag(fc)}
                            disabled={actionLoading === String(fc.container_id)}
                          >
                            {actionLoading === String(fc.container_id) ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            Unflag
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          })()}
        </CardContent>
      </Card>
      <ContainerDetailModal />
    </div>
  );
}
