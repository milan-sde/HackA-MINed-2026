import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { EntityRisk } from "@/types";
import { useDashboardStore } from "@/store/dashboardStore";
import { deriveEntityRisk } from "@/services/api";

function riskColor(score: number) {
  if (score >= 70) return "#EF4444";
  if (score >= 30) return "#F59E0B";
  return "#10B981";
}

interface EntityTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: EntityRisk }>;
}

function EntityTooltip({ active, payload }: EntityTooltipProps) {
  if (!active || !payload?.length) return null;
  const e = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-xs shadow-xl">
      <p className="font-mono font-semibold mb-1">{e.id}</p>
      <p>Country: <span className="font-medium">{e.country}</span></p>
      <p>Risk Score: <span className="font-semibold">{e.riskScore.toFixed(1)}</span></p>
      <p>Critical Shipments: <span className="font-semibold text-red-400">{e.criticalCount}</span> / {e.totalShipments}</p>
    </div>
  );
}

function EntityBarChart({ data, label }: { data: EntityRisk[]; label: string }) {
  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 60, left: 20, bottom: 0 }}
        >
          <CartesianGrid horizontal={false} stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="hsl(var(--border))" />
          <YAxis
            dataKey="id"
            type="category"
            tick={{ fontSize: 10, fontFamily: "monospace" }}
            stroke="none"
            width={65}
          />
          <Tooltip content={<EntityTooltip />} />
          <Bar dataKey="riskScore" radius={[0, 4, 4, 0]}>
            {data.map((d) => (
              <Cell key={d.id} fill={riskColor(d.riskScore)} />
            ))}
            <LabelList
              dataKey="riskScore"
              position="right"
              style={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              formatter={(v: unknown) => Number(v).toFixed(0)}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Table below */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">{label} ID</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground">Country</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground">Risk</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground">Critical</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground">Total</th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground">Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.map((e, i) => (
              <tr
                key={e.id}
                className={i % 2 === 0 ? "bg-card" : "bg-muted/10"}
              >
                <td className="px-3 py-2 font-mono font-semibold">{e.id}</td>
                <td className="px-3 py-2 text-center">{e.country}</td>
                <td className="px-3 py-2 text-center">
                  <Badge
                    variant={e.riskScore >= 70 ? "critical" : e.riskScore >= 30 ? "lowrisk" : "clear"}
                    className="text-[10px]"
                  >
                    {e.riskScore.toFixed(0)}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-center text-red-400 font-semibold">{e.criticalCount}</td>
                <td className="px-3 py-2 text-center">{e.totalShipments}</td>
                <td className="px-3 py-2 text-center">
                  {((e.criticalCount / e.totalShipments) * 100).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function EntityPanel() {
  const containers = useDashboardStore((s) => s.containers);
  const exporters = deriveEntityRisk(containers, "exporterId");
  const importers = deriveEntityRisk(containers, "importerId");

  return (
    <Card>
      <CardHeader>
        <CardTitle>High-Risk Entities</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Top 10 risky exporters and importers by composite risk score
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="exporters">
          <TabsList className="mb-4">
            <TabsTrigger value="exporters">Exporters</TabsTrigger>
            <TabsTrigger value="importers">Importers</TabsTrigger>
          </TabsList>
          <TabsContent value="exporters">
            <EntityBarChart data={exporters} label="Exporter" />
          </TabsContent>
          <TabsContent value="importers">
            <EntityBarChart data={importers} label="Importer" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
