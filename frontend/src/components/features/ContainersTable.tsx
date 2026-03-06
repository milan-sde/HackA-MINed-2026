import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, Filter, AlertCircle, Eye, Flag, BrainCircuit } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, RISK_COLORS } from "@/lib/utils";
import type { Container, RiskLevel } from "@/types";
import { useDashboardStore } from "@/store/dashboardStore";
import { toast } from "sonner";
import { flagContainer as apiFlagContainer } from "@/services/api";

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
            {/* Risk filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <Filter className="h-3 w-3" />
                  Risk Level
                  {riskFilter.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{riskFilter.length}</Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filter by Risk Level</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(["Critical", "Low Risk", "Clear"] as RiskLevel[]).map((level) => (
                  <DropdownMenuCheckboxItem
                    key={level}
                    checked={riskFilter.includes(level)}
                    onCheckedChange={() => toggleRiskFilter(level)}
                  >
                    <span className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ background: RISK_COLORS[level] }} />
                      {level}
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
                <th className={thCls}>
                  <span className="flex items-center gap-1">
                    <BrainCircuit className="h-3 w-3" />
                    AI Explanation
                  </span>
                </th>
                <th className={thCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className={tdCls}><div className="skeleton h-4 rounded w-20" /></td>
                    ))}
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
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
                      container.riskLevel === "Critical" && "hover:bg-red-500/5"
                    )}
                  >
                    <td className={tdCls}>
                      <div className="flex items-center gap-2">
                        {container.anomalyFlag && (
                          <AlertCircle className="h-3.5 w-3.5 text-orange-400 shrink-0" />
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
                      <span className={container.dwellTimeHours > 80 ? "text-orange-400" : ""}>
                        {container.dwellTimeHours.toFixed(0)}h
                      </span>
                    </td>
                    <td className={cn(tdCls, "tabular-nums")}>
                      <span className={container.weightDiscrepancyPct > 20 ? "text-red-400" : ""}>
                        {container.weightDiscrepancyPct > 0 ? "+" : ""}{container.weightDiscrepancyPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className={tdCls}>
                      <div className="max-w-[260px]">
                        <p className="text-xs text-muted-foreground leading-snug line-clamp-1">
                          {container.explanation}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {container.keyRiskFactors.slice(0, 2).map((f) => (
                            <span key={f} className={cn(
                              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
                              container.riskLevel === "Critical"
                                ? "bg-red-500/15 text-red-400"
                                : container.riskLevel === "Low Risk"
                                  ? "bg-orange-500/15 text-orange-400"
                                  : "bg-secondary text-secondary-foreground"
                            )}>
                              <span className="font-bold">+</span> {f}
                            </span>
                          ))}
                        </div>
                      </div>
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
