import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, AlertCircle, Eye, Flag, BrainCircuit, Scale, Clock, DollarSign, UserX, CheckCircle2, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, RISK_COLORS } from "@/lib/utils";
import type { Container, RiskLevel } from "@/types";
import { useDashboardStore } from "@/store/dashboardStore";
import { toast } from "sonner";
import { flagContainer as apiFlagContainer, getAnomalyType, getRecommendedAction, ANOMALY_TYPE_META, type AnomalyType } from "@/services/api";
import { exportContainersCSV } from "@/lib/export";

const ANOMALY_ICONS: Record<AnomalyType, typeof Scale> = {
  weight_mismatch: Scale,
  dwell_time: Clock,
  value_anomaly: DollarSign,
  exporter_risk: UserX,
  normal: CheckCircle2,
};

interface ContainersTableProps {
  containers: Container[];
  loading?: boolean;
}

type SortField = "id" | "riskScore" | "riskLevel" | "originCountry" | "dwellTimeHours" | "weightDiscrepancyPct";
type SortDir = "asc" | "desc";

const PAGE_SIZES = [10, 20, 50];

const RISK_VARIANTS: Record<RiskLevel, "critical" | "lowrisk" | "clear"> = {
  Critical: "critical",
  "Low Risk": "lowrisk",
  Clear: "clear",
};

export default function ContainersTable({ containers, loading }: ContainersTableProps) {
  const { openModal } = useDashboardStore();
  const flaggedIds = useDashboardStore((s) => s.flaggedIds);
  const addFlaggedContainer = useDashboardStore((s) => s.addFlaggedContainer);
  const [flagging, setFlagging] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("riskScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [riskFilter, setRiskFilter] = useState<RiskLevel[]>([]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  }

  function toggleRiskFilter(level: RiskLevel) {
    setRiskFilter((prev) =>
      prev.includes(level) ? prev.filter((x) => x !== level) : [...prev, level]
    );
    setPage(1);
  }

  async function handleTableFlag(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (flaggedIds.includes(id) || flagging.has(id)) return;
    setFlagging((prev) => new Set(prev).add(id));
    try {
      const result = await apiFlagContainer(id, `Flagged from containers table`);
      addFlaggedContainer(result);
      toast.warning(`Container ${id} flagged for inspection`);
    } catch (err) {
      toast.error("Failed to flag container", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setFlagging((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  }

  function handleExportFiltered() {
    const count = exportContainersCSV(filtered, { filenamePrefix: "containers_filtered" });
    if (count > 0) toast.success(`Exported ${count.toLocaleString()} containers to CSV`);
    else toast.warning("No containers to export");
  }

  const filtered = useMemo(() => {
    let result = containers;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        c.id.toLowerCase().includes(q) ||
        c.importerId.toLowerCase().includes(q) ||
        c.exporterId.toLowerCase().includes(q) ||
        c.originCountry.toLowerCase().includes(q)
      );
    }
    if (riskFilter.length) result = result.filter((c) => riskFilter.includes(c.riskLevel));
    return [...result].sort((a, b) => {
      const av = a[sortField as keyof Container] as number | string;
      const bv = b[sortField as keyof Container] as number | string;
      const cmp = typeof av === "number" ? av - (bv as number) : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [containers, search, riskFilter, sortField, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronsUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  }

  const thCls = "text-xs font-medium text-muted-foreground text-left px-3 py-2.5 whitespace-nowrap";
  const tdCls = "px-3 py-3 text-sm";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm font-semibold">
            Containers · <span className="text-muted-foreground font-normal">{filtered.length.toLocaleString()} results</span>
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 w-52 text-xs"
                placeholder="Search ID, importer, exporter…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>

            {/* Risk level pills */}
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 p-1">
              {([
                { level: "Critical" as RiskLevel, color: "#EF4444", activeBg: "bg-red-500/20", activeText: "text-red-400", activeBorder: "border-red-500/40" },
                { level: "Low Risk" as RiskLevel, color: "#F59E0B", activeBg: "bg-amber-500/20", activeText: "text-amber-400", activeBorder: "border-amber-500/40" },
                { level: "Clear" as RiskLevel, color: "#10B981", activeBg: "bg-emerald-500/20", activeText: "text-emerald-400", activeBorder: "border-emerald-500/40" },
              ]).map(({ level, color, activeBg, activeText, activeBorder }) => {
                const isActive = riskFilter.includes(level);
                const count = containers.filter((c) => c.riskLevel === level).length;
                return (
                  <button
                    key={level}
                    onClick={() => toggleRiskFilter(level)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
                      isActive
                        ? `${activeBg} ${activeText} ${activeBorder} border shadow-sm`
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent"
                    )}
                  >
                    <div
                      className={cn("h-2 w-2 rounded-full transition-all", isActive && "ring-2 ring-offset-1 ring-offset-background")}
                      style={{ background: color, boxShadow: isActive ? `0 0 6px ${color}60` : undefined }}
                    />
                    {level}
                    <span className={cn(
                      "ml-0.5 min-w-[18px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-none",
                      isActive ? `${activeBg} ${activeText}` : "bg-muted text-muted-foreground"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
              {riskFilter.length > 0 && (
                <button
                  onClick={() => { setRiskFilter([]); setPage(1); }}
                  className="ml-0.5 rounded-md px-2 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Export filtered */}
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/20"
              onClick={handleExportFiltered}
              disabled={filtered.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {[
                  { field: "id" as SortField, label: "Container ID" },
                  { field: "riskScore" as SortField, label: "Risk Score" },
                  { field: "riskLevel" as SortField, label: "Risk Level" },
                  { field: "originCountry" as SortField, label: "Origin" },
                  { field: "dwellTimeHours" as SortField, label: "Dwell (hrs)" },
                  { field: "weightDiscrepancyPct" as SortField, label: "Weight Δ%" },
                ].map(({ field, label }) => (
                  <th key={field} className={thCls}>
                    <button
                      onClick={() => toggleSort(field)}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {label}
                      <SortIcon field={field} />
                    </button>
                  </th>
                ))}
                <th className={thCls}>Anomaly</th>
                <th className={thCls}>Recommended Action</th>
                <th className={thCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className={tdCls}><div className="skeleton h-4 rounded w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">
                    No containers match your filters
                  </td>
                </tr>
              ) : (
                paginated.map((container) => (
                  <tr
                    key={container.id}
                    onClick={() => openModal(container)}
                    className={cn(
                      "border-b border-border cursor-pointer transition-colors hover:bg-accent/50",
                      container.riskLevel === "Critical" && "bg-red-500/[0.06] hover:bg-red-500/15 border-l-2 border-l-red-500",
                      container.riskLevel === "Low Risk" && container.anomalyFlag && "border-l-2 border-l-amber-500/50"
                    )}
                  >
                    <td className={tdCls}>
                      <div className="flex items-center gap-2">
                        {container.anomalyFlag && (
                          <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        )}
                        {flaggedIds.includes(container.id) && (
                          <Flag className="h-3.5 w-3.5 text-red-400 fill-current shrink-0" />
                        )}
                        <span className="font-mono text-xs font-medium">{container.id}</span>
                      </div>
                    </td>
                    <td className={tdCls}>
                      <div className="flex items-center gap-2 min-w-[80px]">
                        <Progress
                          value={container.riskScore}
                          className="h-1.5 w-16"
                          style={{
                            "--tw-bg-opacity": "1",
                          } as React.CSSProperties}
                        />
                        <span className="text-xs font-semibold tabular-nums" style={{ color: RISK_COLORS[container.riskLevel] }}>
                          {container.riskScore.toFixed(0)}
                        </span>
                      </div>
                    </td>
                    <td className={tdCls}>
                      <Badge variant={RISK_VARIANTS[container.riskLevel]}>
                        {container.riskLevel}
                      </Badge>
                    </td>
                    <td className={tdCls}>
                      <span className="text-base leading-none">{container.originFlag}</span>
                      <span className="ml-1.5 text-xs text-muted-foreground">{container.originCountry}</span>
                    </td>
                    <td className={cn(tdCls, "tabular-nums")}>
                      <span className={container.dwellTimeHours > 80 ? "text-amber-400" : ""}>
                        {container.dwellTimeHours.toFixed(0)}h
                      </span>
                    </td>
                    <td className={cn(tdCls, "tabular-nums")}>
                      <span className={container.weightDiscrepancyPct > 20 ? "text-red-400" : ""}>
                        {container.weightDiscrepancyPct > 0 ? "+" : ""}{container.weightDiscrepancyPct.toFixed(1)}%
                      </span>
                    </td>
                    {/* Anomaly type icon */}
                    <td className={tdCls}>
                      {(() => {
                        const aType = getAnomalyType(container);
                        const meta = ANOMALY_TYPE_META[aType];
                        const AIcon = ANOMALY_ICONS[aType];
                        return (
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium"
                                style={{ background: `${meta.color}18`, color: meta.color }}
                              >
                                <AIcon className="h-3 w-3" />
                                {meta.label}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              Primary anomaly: {meta.label}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })()}
                    </td>
                    {/* Recommended action */}
                    <td className={tdCls}>
                      <span className={cn(
                        "text-[11px] font-medium leading-snug line-clamp-2 max-w-[200px] block",
                        container.riskLevel === "Critical" ? "text-red-400" : container.riskLevel === "Low Risk" ? "text-amber-400" : "text-muted-foreground"
                      )}>
                        {getRecommendedAction(container)}
                      </span>
                    </td>
                    <td className={tdCls} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openModal(container)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn("h-7 w-7", flaggedIds.includes(container.id) && "text-red-400")}
                          onClick={(e) => handleTableFlag(container.id, e)}
                          disabled={flaggedIds.includes(container.id) || flagging.has(container.id)}
                        >
                          <Flag className={cn("h-3.5 w-3.5", flaggedIds.includes(container.id) && "fill-current")} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Show</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  {pageSize} <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {PAGE_SIZES.map((s) => (
                  <DropdownMenuCheckboxItem
                    key={s}
                    checked={pageSize === s}
                    onCheckedChange={() => { setPageSize(s); setPage(1); }}
                  >
                    {s} per page
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <span>of {filtered.length.toLocaleString()} rows</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="sm" className="h-7 text-xs"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Prev
            </Button>
            <span className="text-xs text-muted-foreground px-2">{page} / {totalPages}</span>
            <Button
              variant="outline" size="sm" className="h-7 text-xs"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
