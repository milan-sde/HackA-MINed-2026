import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Cell, Tooltip, CartesianGrid,
  ReferenceLine, LabelList,
} from "recharts";
import {
  Flag, FileText, AlertTriangle, Info, Copy, Check, Loader2,
  BrainCircuit, TrendingUp, TrendingDown, Minus, ShieldAlert,
  MessageSquare, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Container } from "@/types";
import { useDashboardStore } from "@/store/dashboardStore";
import { toast } from "sonner";
import {
  flagContainer as apiFlagContainer,
  addContainerNote as apiAddNote,
  fetchContainerNotes,
  type ContainerNote,
} from "@/services/api";

// ── Risk gauge with threshold markers ────────────────────────────────────

function RiskGauge({ score, level }: { score: number; level: string }) {
  const color = score >= 70 ? "#ff4b4b" : score >= 30 ? "#ffa64b" : "#4bff4b";
  const r = 72;
  const cx = 100, cy = 100;

  function toRad(deg: number) { return (deg - 90) * (Math.PI / 180); }
  function arcPath(startDeg: number, endDeg: number, radius: number) {
    const s = { x: cx + radius * Math.cos(toRad(startDeg)), y: cy + radius * Math.sin(toRad(startDeg)) };
    const e = { x: cx + radius * Math.cos(toRad(endDeg)), y: cy + radius * Math.sin(toRad(endDeg)) };
    const large = (endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const startA = -135;
  const sweep = 270;
  const needleAngle = startA + (score / 100) * sweep;
  const threshLow = startA + (30 / 100) * sweep;
  const threshHigh = startA + (70 / 100) * sweep;

  const trackArc = arcPath(startA, startA + sweep, r);
  const clearArc = arcPath(startA, threshLow, r);
  const lowRiskArc = arcPath(threshLow, threshHigh, r);
  const criticalArc = arcPath(threshHigh, startA + sweep, r);
  const fillArc = arcPath(startA, needleAngle, r);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 145" className="w-full max-w-[210px]">
        <path d={trackArc} fill="none" stroke="hsl(var(--muted))" strokeWidth={14} strokeLinecap="round" />
        <path d={clearArc} fill="none" stroke="#4bff4b" strokeWidth={14} strokeLinecap="round" opacity={0.15} />
        <path d={lowRiskArc} fill="none" stroke="#ffa64b" strokeWidth={14} opacity={0.15} />
        <path d={criticalArc} fill="none" stroke="#ff4b4b" strokeWidth={14} strokeLinecap="round" opacity={0.15} />
        <path d={fillArc} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" />
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize={32} fontWeight={800} fill={color}>{score.toFixed(1)}</text>
        <text x={cx} y={cy + 19} textAnchor="middle" fontSize={10} fontWeight={600} fill="hsl(var(--muted-foreground))">RISK SCORE</text>
        <text x={16} y={120} fontSize={8} fill="#4bff4b">Clear</text>
        <text x={80} y={22} textAnchor="middle" fontSize={8} fill="#ffa64b">Low Risk</text>
        <text x={170} y={120} fontSize={8} fill="#ff4b4b" textAnchor="end">Critical</text>
      </svg>
      <Badge
        variant={level === "Critical" ? "critical" : level === "Low Risk" ? "lowrisk" : "clear"}
        className="mt-1 text-xs"
      >
        {level}
      </Badge>
    </div>
  );
}

// ── Feature impact chart (SHAP-style horizontal bars) ────────────────────

interface FeatureImpact {
  name: string;
  label: string;
  value: number;
  rawMetric: string;
  direction: "up" | "down" | "neutral";
}

function buildFeatureImpacts(c: Container): FeatureImpact[] {
  const s = c.featureScores;
  return [
    {
      name: "Weight Discrepancy",
      label: "Weight Disc.",
      value: Math.round(s.weightDiscrepancy * 100),
      rawMetric: `${c.weightDiscrepancyPct > 0 ? "+" : ""}${c.weightDiscrepancyPct.toFixed(1)}%`,
      direction: s.weightDiscrepancy > 0.3 ? "up" : s.weightDiscrepancy > 0.1 ? "neutral" : "down",
    },
    {
      name: "Value Ratio",
      label: "Value / kg",
      value: Math.round(s.valueRatio * 100),
      rawMetric: `$${(c.declaredValue / (c.declaredWeight + 0.001)).toFixed(1)}/kg`,
      direction: s.valueRatio > 0.5 ? "up" : s.valueRatio > 0.2 ? "neutral" : "down",
    },
    {
      name: "Dwell Time",
      label: "Dwell Time",
      value: Math.round(s.dwellTime * 100),
      rawMetric: `${c.dwellTimeHours.toFixed(0)} hrs`,
      direction: s.dwellTime > 0.4 ? "up" : s.dwellTime > 0.15 ? "neutral" : "down",
    },
    {
      name: "Route Risk",
      label: "Route Risk",
      value: Math.round(s.routeRisk * 100),
      rawMetric: `${c.originCountry} → ${c.destinationCountry}`,
      direction: s.routeRisk > 0.5 ? "up" : s.routeRisk > 0.2 ? "neutral" : "down",
    },
    {
      name: "Entity History",
      label: "Entity Hist.",
      value: Math.round(s.entityHistory * 100),
      rawMetric: c.exporterId,
      direction: s.entityHistory > 0.3 ? "up" : s.entityHistory > 0.1 ? "neutral" : "down",
    },
  ].sort((a, b) => b.value - a.value);
}

function impactColor(value: number) {
  if (value >= 60) return "#ff4b4b";
  if (value >= 35) return "#ffa64b";
  return "#4bff4b";
}

function ImpactTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: FeatureImpact }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-xs shadow-xl">
      <p className="font-semibold mb-1">{d.name}</p>
      <p>Impact: <span className="font-semibold" style={{ color: impactColor(d.value) }}>{d.value}%</span></p>
      <p>Metric: <span className="font-medium">{d.rawMetric}</span></p>
    </div>
  );
}

function FeatureImpactChart({ container }: { container: Container }) {
  const impacts = useMemo(() => buildFeatureImpacts(container), [container]);

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={impacts} layout="vertical" margin={{ top: 0, right: 50, left: 80, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--border))" />
          <YAxis
            dataKey="label"
            type="category"
            tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
            stroke="none"
            width={75}
          />
          <Tooltip content={<ImpactTooltip />} />
          <ReferenceLine x={35} stroke="#ffa64b" strokeDasharray="3 3" opacity={0.5} />
          <ReferenceLine x={60} stroke="#ff4b4b" strokeDasharray="3 3" opacity={0.5} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
            {impacts.map((d, i) => (
              <Cell key={i} fill={impactColor(d.value)} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              style={{ fontSize: 11, fontWeight: 600, fill: "hsl(var(--muted-foreground))" }}
              formatter={(v: unknown) => `${v}%`}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Radar chart ──────────────────────────────────────────────────────────

function FeatureRadar({ scores }: { scores: Container["featureScores"] }) {
  const data = [
    { subject: "Weight Disc.", value: Math.round(scores.weightDiscrepancy * 100) },
    { subject: "Value Ratio", value: Math.round(scores.valueRatio * 100) },
    { subject: "Dwell Time", value: Math.round(scores.dwellTime * 100) },
    { subject: "Route Risk", value: Math.round(scores.routeRisk * 100) },
    { subject: "Entity Hist.", value: Math.round(scores.entityHistory * 100) },
  ];
  return (
    <ResponsiveContainer width="100%" height={230}>
      <RadarChart data={data} margin={{ top: 10, right: 25, bottom: 10, left: 25 }}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
        <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ── Top risk factors card ────────────────────────────────────────────────

function DirectionIcon({ dir }: { dir: "up" | "down" | "neutral" }) {
  if (dir === "up") return <TrendingUp className="h-3.5 w-3.5 text-red-400" />;
  if (dir === "down") return <TrendingDown className="h-3.5 w-3.5 text-green-400" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function TopRiskFactors({ container }: { container: Container }) {
  const impacts = useMemo(() => buildFeatureImpacts(container), [container]);
  const top = impacts.filter((f) => f.value > 10);

  return (
    <div className="space-y-2">
      {top.map((f) => (
        <div
          key={f.name}
          className={cn(
            "flex items-center gap-3 rounded-lg border p-3 transition-colors",
            f.value >= 60
              ? "border-red-500/30 bg-red-500/5"
              : f.value >= 35
                ? "border-orange-500/30 bg-orange-500/5"
                : "border-border bg-muted/20",
          )}
        >
          <DirectionIcon dir={f.direction} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{f.name}</p>
            <p className="text-xs text-muted-foreground">{f.rawMetric}</p>
          </div>
          <div className="text-right shrink-0">
            <p
              className="text-sm font-bold tabular-nums"
              style={{ color: impactColor(f.value) }}
            >
              {f.direction === "up" ? "+" : f.direction === "down" ? "-" : ""}{f.value}%
            </p>
            <p className="text-[10px] text-muted-foreground">impact</p>
          </div>
        </div>
      ))}
      {top.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">No significant risk factors detected.</p>
      )}
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────

export default function ContainerDetailModal() {
  const { selectedContainer: container, closeModal } = useDashboardStore();
  const flaggedIds = useDashboardStore((s) => s.flaggedIds);
  const containerNotesMap = useDashboardStore((s) => s.containerNotes);
  const addFlaggedId = useDashboardStore((s) => s.addFlaggedId);
  const setNotesForContainer = useDashboardStore((s) => s.setNotesForContainer);
  const appendNote = useDashboardStore((s) => s.appendNote);

  const [note, setNote] = useState("");
  const [flagLoading, setFlagLoading] = useState(false);
  const [noteLoading, setNoteLoading] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("explain");

  const isFlagged = container ? flaggedIds.includes(container.id) : false;
  const savedNotes: ContainerNote[] = container
    ? (containerNotesMap[container.id] ?? [])
    : [];

  const loadNotes = useCallback(async (cid: string) => {
    setNotesLoading(true);
    try {
      const notes = await fetchContainerNotes(cid);
      setNotesForContainer(cid, notes);
    } catch { /* silent */ }
    setNotesLoading(false);
  }, [setNotesForContainer]);

  useEffect(() => {
    if (container && activeTab === "notes") {
      loadNotes(container.id);
    }
  }, [container?.id, activeTab, loadNotes, container]);

  useEffect(() => {
    if (container) setActiveTab("explain");
  }, [container?.id, container]);

  async function handleFlag() {
    if (!container || isFlagged) return;
    setFlagLoading(true);
    try {
      await apiFlagContainer(container.id, `Flagged from dashboard — Risk Score ${container.riskScore}`);
      addFlaggedId(container.id);
      toast.success(`Container ${container.id} flagged for inspection`);
    } catch (e) {
      toast.error("Failed to flag container", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
    setFlagLoading(false);
  }

  async function handleSaveNote() {
    if (!container || !note.trim()) return;
    setNoteLoading(true);
    try {
      const saved = await apiAddNote(container.id, note.trim());
      appendNote(container.id, saved);
      setNote("");
      toast.success("Note saved");
    } catch (e) {
      toast.error("Failed to save note", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
    setNoteLoading(false);
  }

  if (!container) return null;

  const riskVariant = container.riskLevel === "Critical" ? "critical" : container.riskLevel === "Low Risk" ? "lowrisk" : "clear";

  function copy() {
    navigator.clipboard.writeText(container!.id).then(() => toast.success("Copied to clipboard"));
  }

  return (
    <Dialog open={!!container} onOpenChange={(o) => !o && closeModal()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex items-start justify-between pr-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <DialogTitle className="font-mono text-lg">{container.id}</DialogTitle>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copy}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={riskVariant}>{container.riskLevel}</Badge>
                <span className="text-xs text-muted-foreground">{container.originFlag} {container.originCountry} → {container.destinationCountry}</span>
                <span className="text-xs text-muted-foreground">HS {container.hsCode}</span>
                {container.anomalyFlag && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />Anomaly
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>
        <DialogBody>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="explain" className="gap-1.5">
                <BrainCircuit className="h-3.5 w-3.5" />
                AI Explanation
              </TabsTrigger>
              <TabsTrigger value="features">Feature Analysis</TabsTrigger>
              <TabsTrigger value="details">Shipment Details</TabsTrigger>
              <TabsTrigger value="notes" className="gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                Notes & Actions
                {isFlagged && (
                  <Badge variant="destructive" className="ml-1 h-4 px-1 text-[9px]">
                    Flagged
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── AI Explanation (new default tab) ──────────────────── */}
            <TabsContent value="explain">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Left: Gauge */}
                <div className="flex flex-col items-center bg-muted/30 rounded-xl p-5">
                  <RiskGauge score={container.riskScore} level={container.riskLevel} />
                  <p className="text-[10px] text-muted-foreground mt-2 text-center">
                    Ensemble: XGBoost + Isolation Forest + Rules
                  </p>
                </div>

                {/* Right: Explanation + Factors */}
                <div className="md:col-span-2 space-y-4">
                  {/* AI Explanation Card */}
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BrainCircuit className="h-4 w-4 text-primary" />
                      <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                        AI Explanation
                      </p>
                    </div>
                    <p className="text-sm leading-relaxed">{container.explanation}</p>
                  </div>

                  {/* Top Risk Factors */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Top Risk Factors
                      </p>
                    </div>
                    <TopRiskFactors container={container} />
                  </div>
                </div>
              </div>

              {/* Quick metrics row */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-5">
                {[
                  { label: "Weight Δ", value: `${container.weightDiscrepancyPct > 0 ? "+" : ""}${container.weightDiscrepancyPct.toFixed(1)}%`, alert: container.weightDiscrepancyPct > 20 },
                  { label: "Dwell", value: `${container.dwellTimeHours.toFixed(0)}h`, alert: container.dwellTimeHours > 80 },
                  { label: "Value", value: `$${container.declaredValue.toLocaleString()}`, alert: false },
                  { label: "Wt Declared", value: `${container.declaredWeight.toLocaleString()} kg`, alert: false },
                  { label: "Wt Measured", value: `${container.measuredWeight.toLocaleString()} kg`, alert: container.weightDiscrepancyPct > 20 },
                  { label: "HS Chapter", value: `${container.hsChapter}`, alert: false },
                ].map(({ label, value, alert }) => (
                  <div key={label} className="rounded-lg border border-border bg-card p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                    <p className={cn("text-sm font-semibold mt-0.5 tabular-nums", alert && "text-orange-400")}>{value}</p>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ── Feature Analysis ──────────────────────────────────── */}
            <TabsContent value="features">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Feature Impact (higher = more risk contribution)
                  </p>
                  <FeatureImpactChart container={container} />
                  <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#4bff4b]" /> Low (&lt;35%)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#ffa64b]" /> Medium (35-60%)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#ff4b4b]" /> High (&gt;60%)
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Risk Profile Radar
                  </p>
                  <FeatureRadar scores={container.featureScores} />
                </div>
              </div>

              <Separator className="my-5" />

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Detected Risk Signals
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {container.keyRiskFactors.map((f) => (
                    <div key={f} className="flex items-center gap-2.5 rounded-lg bg-muted/30 px-3 py-2.5">
                      <div className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
                      <span className="text-sm">{f}</span>
                    </div>
                  ))}
                  {container.keyRiskFactors.length === 0 && (
                    <p className="text-sm text-muted-foreground">No significant risk signals.</p>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── Shipment Details ──────────────────────────────────── */}
            <TabsContent value="details">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                {[
                  ["Container ID", container.id],
                  ["Declaration Date", container.declarationDate],
                  ["Trade Regime", container.tradeRegime],
                  ["Origin Country", `${container.originFlag} ${container.originCountry}`],
                  ["Destination", container.destinationCountry],
                  ["Destination Port", container.destinationPort],
                  ["HS Code", container.hsCode],
                  ["Importer ID", container.importerId],
                  ["Exporter ID", container.exporterId],
                  ["Declared Value", `$${container.declaredValue.toLocaleString()}`],
                  ["Declared Weight", `${container.declaredWeight.toLocaleString()} kg`],
                  ["Measured Weight", `${container.measuredWeight.toLocaleString()} kg`],
                ].map(([label, value]) => (
                  <div key={label as string} className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                    <p className="font-medium truncate">{value}</p>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ── Notes & Actions ───────────────────────────────────── */}
            <TabsContent value="notes">
              <div className="space-y-5">
                {/* Action buttons */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Actions</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={isFlagged ? "outline" : "destructive"}
                      size="sm"
                      className="gap-2"
                      onClick={handleFlag}
                      disabled={isFlagged || flagLoading}
                    >
                      {flagLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isFlagged ? (
                        <Check className="h-3.5 w-3.5 text-green-400" />
                      ) : (
                        <Flag className="h-3.5 w-3.5" />
                      )}
                      {isFlagged ? "Flagged for Inspection" : "Flag for Inspection"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        const text = [
                          `Container: ${container.id}`,
                          `Risk Score: ${container.riskScore}`,
                          `Risk Level: ${container.riskLevel}`,
                          `Explanation: ${container.explanation}`,
                          `Origin: ${container.originCountry} → ${container.destinationCountry}`,
                          `Key Factors: ${container.keyRiskFactors.join(", ")}`,
                        ].join("\n");
                        navigator.clipboard.writeText(text);
                        toast.success("Report copied to clipboard");
                      }}
                    >
                      <FileText className="h-3.5 w-3.5" />Export Report
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2"
                      onClick={() => toast.info("Verification request sent")}
                    >
                      <Info className="h-3.5 w-3.5" />Request Verification
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Add note */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Add Note</p>
                  <textarea
                    className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    rows={3}
                    placeholder="Add an inspection note or comment..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <Button
                    size="sm"
                    className="mt-2 gap-2"
                    onClick={handleSaveNote}
                    disabled={!note.trim() || noteLoading}
                  >
                    {noteLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Save Note
                  </Button>
                </div>

                {/* Saved notes list */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Saved Notes {savedNotes.length > 0 && `(${savedNotes.length})`}
                  </p>
                  {notesLoading ? (
                    <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading notes...
                    </div>
                  ) : savedNotes.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No notes yet for this container.</p>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                      {savedNotes.map((n, i) => (
                        <div
                          key={`${n.timestamp}-${i}`}
                          className="rounded-lg border border-border bg-muted/20 p-3"
                        >
                          <p className="text-sm">{n.note}</p>
                          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(n.timestamp).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
