import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Cell, Tooltip, CartesianGrid, LabelList,
} from "recharts";
import { Flag, FileText, AlertTriangle, Info, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Container } from "@/types";
import { useDashboardStore } from "@/store/dashboardStore";
import { toast } from "sonner";

function RiskGauge({ score }: { score: number }) {
  const angle = -135 + (score / 100) * 270;
  const color = score >= 70 ? "#ff4b4b" : score >= 30 ? "#ffa64b" : "#4bff4b";
  const r = 70;
  const cx = 100, cy = 100;
  const endAngle = (angle - 90) * (Math.PI / 180);

  function arcPath(start: number, end: number, radius: number) {
    const s = { x: cx + radius * Math.cos(start), y: cy + radius * Math.sin(start) };
    const e = { x: cx + radius * Math.cos(end), y: cy + radius * Math.sin(end) };
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const totalArc = arcPath(-225 * (Math.PI / 180), 45 * (Math.PI / 180), r);
  const filledArc = arcPath(-225 * (Math.PI / 180), endAngle, r);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 140" className="w-full max-w-[200px]">
        {/* Track */}
        <path d={totalArc} fill="none" stroke="hsl(var(--muted))" strokeWidth={12} strokeLinecap="round" />
        {/* Fill */}
        <path d={filledArc} fill="none" stroke={color} strokeWidth={12} strokeLinecap="round" />
        {/* Center text */}
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={28} fontWeight={700} fill={color}>{score.toFixed(0)}</text>
        <text x={cx} y={cy + 22} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))">Risk Score</text>
        {/* Labels */}
        <text x={18} y={115} fontSize={9} fill="hsl(var(--muted-foreground))">0</text>
        <text x={100} y={25} textAnchor="middle" fontSize={9} fill="hsl(var(--muted-foreground))">50</text>
        <text x={176} y={115} fontSize={9} fill="hsl(var(--muted-foreground))">100</text>
      </svg>
    </div>
  );
}

function FeatureRadar({ scores }: { scores: Container["featureScores"] }) {
  const data = [
    { subject: "Weight Disc.", value: Math.round(scores.weightDiscrepancy * 100) },
    { subject: "Value Ratio", value: Math.round(scores.valueRatio * 100) },
    { subject: "Dwell Time", value: Math.round(scores.dwellTime * 100) },
    { subject: "Route Risk", value: Math.round(scores.routeRisk * 100) },
    { subject: "Entity Hist.", value: Math.round(scores.entityHistory * 100) },
  ];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
        <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function WaterfallChart({ container }: { container: Container }) {
  const data = [
    { name: "Base", value: 15, positive: true },
    { name: "Weight Δ", value: Math.round(container.featureScores.weightDiscrepancy * 35), positive: container.featureScores.weightDiscrepancy > 0.3 },
    { name: "Dwell", value: Math.round(container.featureScores.dwellTime * 25), positive: container.featureScores.dwellTime > 0.4 },
    { name: "Route", value: Math.round(container.featureScores.routeRisk * 15), positive: container.featureScores.routeRisk > 0.5 },
    { name: "Entity", value: Math.round(container.featureScores.entityHistory * 20), positive: container.featureScores.entityHistory > 0.1 },
    { name: "Value", value: Math.round(container.featureScores.valueRatio * 10), positive: container.featureScores.valueRatio > 0.7 },
  ];
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke="hsl(var(--border))" opacity={0.4} />
        <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--border))" domain={[0, 40]} />
        <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} stroke="none" />
        <Tooltip formatter={(v) => [`${v} pts`, "Contribution"]} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.positive ? "#ff4b4b" : "#4bff4b"} />
          ))}
          <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} formatter={(v: unknown) => `+${v}`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function ContainerDetailModal() {
  const { selectedContainer: container, closeModal } = useDashboardStore();
  const [note, setNote] = useState("");

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
                    <AlertTriangle className="h-3 w-3" />Anomaly Detected
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>
        <DialogBody>
          <Tabs defaultValue="overview">
            <TabsList className="mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="features">Feature Analysis</TabsTrigger>
              <TabsTrigger value="details">Shipment Details</TabsTrigger>
              <TabsTrigger value="notes">Notes & Actions</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col items-center bg-muted/30 rounded-xl p-4">
                  <RiskGauge score={container.riskScore} />
                  <p className="text-xs text-muted-foreground mt-1">Ensemble Score (XGB · IF · Rules)</p>
                </div>
                <div className="md:col-span-2 space-y-3">
                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Risk Summary</p>
                    <p className="text-sm">{container.explanation}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: "Weight Discrepancy", value: `${container.weightDiscrepancyPct > 0 ? "+" : ""}${container.weightDiscrepancyPct.toFixed(1)}%`, alert: container.weightDiscrepancyPct > 20 },
                      { label: "Dwell Time", value: `${container.dwellTimeHours.toFixed(0)} hrs`, alert: container.dwellTimeHours > 80 },
                      { label: "Declared Value", value: `$${container.declaredValue.toLocaleString()}`, alert: false },
                      { label: "Declared Weight", value: `${container.declaredWeight.toLocaleString()} kg`, alert: false },
                      { label: "Measured Weight", value: `${container.measuredWeight.toLocaleString()} kg`, alert: container.weightDiscrepancyPct > 20 },
                      { label: "HS Chapter", value: `CH ${container.hsChapter}`, alert: false },
                    ].map(({ label, value, alert }) => (
                      <div key={label} className="rounded-lg bg-card border border-border p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                        <p className={cn("text-sm font-semibold mt-0.5 tabular-nums", alert && "text-orange-400")}>{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Features */}
            <TabsContent value="features">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Risk Factor Radar</p>
                  <FeatureRadar scores={container.featureScores} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Feature Contributions</p>
                  <WaterfallChart container={container} />
                  <ul className="mt-3 space-y-1">
                    {container.keyRiskFactors.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </TabsContent>

            {/* Details */}
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

            {/* Notes */}
            <TabsContent value="notes">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant="destructive" size="sm" className="gap-2">
                    <Flag className="h-3.5 w-3.5" />Flag for Inspection
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <FileText className="h-3.5 w-3.5" />Export Report
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Info className="h-3.5 w-3.5" />Request Verification
                  </Button>
                </div>
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Add Note</p>
                  <textarea
                    className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    rows={3}
                    placeholder="Add an inspection note or comment…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => { toast.success("Note saved"); setNote(""); }}
                    disabled={!note.trim()}
                  >
                    Save Note
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
