import { useEffect, useState, useCallback } from "react";
import {
  ShieldAlert, RefreshCw, Clock, MapPin,
  AlertTriangle, Eye, Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardStore } from "@/store/dashboardStore";
import { fetchFlaggedContainers, type FlaggedContainer } from "@/services/api";
import { cn, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

function riskBadge(score: number | null) {
  if (score === null) return <Badge variant="outline">N/A</Badge>;
  if (score >= 70) return <Badge variant="destructive">{score.toFixed(1)}</Badge>;
  if (score >= 30)
    return (
      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
        {score.toFixed(1)}
      </Badge>
    );
  return (
    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
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
      toast.info(`Container ${fc.container_id} not in current dataset`);
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
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ShieldAlert className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {formatNumber(flaggedContainers.length)}
              </p>
              <p className="text-xs text-muted-foreground">Total Flagged</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-red-400">
                {formatNumber(criticalCount)}
              </p>
              <p className="text-xs text-muted-foreground">Critical Risk</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
              <Clock className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {formatNumber(flaggedContainers.filter((f) => f.status === "flagged").length)}
              </p>
              <p className="text-xs text-muted-foreground">Pending Review</p>
            </div>
          </CardContent>
        </Card>
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
                              ? "border-orange-500/50 text-orange-400"
                              : "border-green-500/50 text-green-400",
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
    </div>
  );
}
