import { useState, useMemo, useCallback } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Container } from "@/types";
import { deriveCountryRisk, type CountryRisk } from "@/services/api";
import { formatNumber } from "@/lib/utils";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ISO 3166-1 numeric → alpha-2 (comprehensive for trade/customs)
const NUM_TO_A2: Record<string, string> = {
  "004": "AF", "008": "AL", "012": "DZ", "020": "AD", "024": "AO",
  "032": "AR", "036": "AU", "040": "AT", "031": "AZ", "044": "BS",
  "048": "BH", "050": "BD", "052": "BB", "056": "BE", "064": "BT",
  "068": "BO", "070": "BA", "072": "BW", "076": "BR", "084": "BZ",
  "096": "BN", "100": "BG", "104": "MM", "108": "BI", "112": "BY",
  "116": "KH", "120": "CM", "124": "CA", "140": "CF", "144": "LK",
  "148": "TD", "152": "CL", "156": "CN", "158": "TW", "170": "CO",
  "178": "CG", "180": "CD", "188": "CR", "191": "HR", "192": "CU",
  "196": "CY", "203": "CZ", "204": "BJ", "208": "DK", "214": "DO",
  "218": "EC", "222": "SV", "226": "GQ", "231": "ET", "232": "ER",
  "233": "EE", "242": "FJ", "246": "FI", "250": "FR", "262": "DJ",
  "266": "GA", "268": "GE", "270": "GM", "276": "DE", "288": "GH",
  "300": "GR", "304": "GL", "320": "GT", "324": "GN", "328": "GY",
  "332": "HT", "340": "HN", "344": "HK", "348": "HU", "352": "IS",
  "356": "IN", "360": "ID", "364": "IR", "368": "IQ", "372": "IE",
  "376": "IL", "380": "IT", "384": "CI", "388": "JM", "392": "JP",
  "398": "KZ", "400": "JO", "404": "KE", "408": "KP", "410": "KR",
  "414": "KW", "417": "KG", "418": "LA", "422": "LB", "426": "LS",
  "428": "LV", "430": "LR", "434": "LY", "440": "LT", "442": "LU",
  "450": "MG", "454": "MW", "458": "MY", "462": "MV", "466": "ML",
  "470": "MT", "478": "MR", "480": "MU", "484": "MX", "496": "MN",
  "498": "MD", "504": "MA", "508": "MZ", "512": "OM", "516": "NA",
  "524": "NP", "528": "NL", "540": "NC", "548": "VU", "554": "NZ",
  "558": "NI", "562": "NE", "566": "NG", "578": "NO", "586": "PK",
  "591": "PA", "598": "PG", "600": "PY", "604": "PE", "608": "PH",
  "616": "PL", "620": "PT", "624": "GW", "626": "TL", "634": "QA",
  "642": "RO", "643": "RU", "646": "RW", "682": "SA", "686": "SN",
  "694": "SL", "702": "SG", "703": "SK", "704": "VN", "705": "SI",
  "706": "SO", "710": "ZA", "716": "ZW", "724": "ES", "728": "SS",
  "729": "SD", "740": "SR", "748": "SZ", "752": "SE", "756": "CH",
  "760": "SY", "762": "TJ", "764": "TH", "768": "TG", "780": "TT",
  "784": "AE", "788": "TN", "792": "TR", "795": "TM", "800": "UG",
  "804": "UA", "807": "MK", "818": "EG", "826": "GB", "834": "TZ",
  "840": "US", "854": "BF", "858": "UY", "860": "UZ", "862": "VE",
  "887": "YE", "894": "ZM",
};

const COUNTRY_NAMES: Record<string, string> = {
  AF: "Afghanistan", AL: "Albania", DZ: "Algeria", AD: "Andorra", AO: "Angola",
  AR: "Argentina", AU: "Australia", AT: "Austria", AZ: "Azerbaijan", BS: "Bahamas",
  BH: "Bahrain", BD: "Bangladesh", BB: "Barbados", BE: "Belgium", BT: "Bhutan",
  BO: "Bolivia", BA: "Bosnia & Herzegovina", BW: "Botswana", BR: "Brazil",
  BZ: "Belize", BN: "Brunei", BG: "Bulgaria", MM: "Myanmar", BI: "Burundi",
  BY: "Belarus", KH: "Cambodia", CM: "Cameroon", CA: "Canada", CF: "Central African Rep.",
  LK: "Sri Lanka", TD: "Chad", CL: "Chile", CN: "China", TW: "Taiwan",
  CO: "Colombia", CG: "Congo", CD: "DR Congo", CR: "Costa Rica", HR: "Croatia",
  CU: "Cuba", CY: "Cyprus", CZ: "Czechia", BJ: "Benin", DK: "Denmark",
  DO: "Dominican Rep.", EC: "Ecuador", SV: "El Salvador", GQ: "Eq. Guinea",
  ET: "Ethiopia", ER: "Eritrea", EE: "Estonia", FJ: "Fiji", FI: "Finland",
  FR: "France", DJ: "Djibouti", GA: "Gabon", GE: "Georgia", GM: "Gambia",
  DE: "Germany", GH: "Ghana", GR: "Greece", GL: "Greenland", GT: "Guatemala",
  GN: "Guinea", GY: "Guyana", HT: "Haiti", HN: "Honduras", HK: "Hong Kong",
  HU: "Hungary", IS: "Iceland", IN: "India", ID: "Indonesia", IR: "Iran",
  IQ: "Iraq", IE: "Ireland", IL: "Israel", IT: "Italy", CI: "Ivory Coast",
  JM: "Jamaica", JP: "Japan", KZ: "Kazakhstan", JO: "Jordan", KE: "Kenya",
  KP: "North Korea", KR: "South Korea", KW: "Kuwait", KG: "Kyrgyzstan",
  LA: "Laos", LB: "Lebanon", LS: "Lesotho", LV: "Latvia", LR: "Liberia",
  LY: "Libya", LT: "Lithuania", LU: "Luxembourg", MG: "Madagascar",
  MW: "Malawi", MY: "Malaysia", MV: "Maldives", ML: "Mali", MT: "Malta",
  MR: "Mauritania", MU: "Mauritius", MX: "Mexico", MN: "Mongolia",
  MD: "Moldova", MA: "Morocco", MZ: "Mozambique", OM: "Oman", NA: "Namibia",
  NP: "Nepal", NL: "Netherlands", NC: "New Caledonia", VU: "Vanuatu",
  NZ: "New Zealand", NI: "Nicaragua", NE: "Niger", NG: "Nigeria", NO: "Norway",
  PK: "Pakistan", PA: "Panama", PG: "Papua New Guinea", PY: "Paraguay",
  PE: "Peru", PH: "Philippines", PL: "Poland", PT: "Portugal", GW: "Guinea-Bissau",
  TL: "Timor-Leste", QA: "Qatar", RO: "Romania", RU: "Russia", RW: "Rwanda",
  SA: "Saudi Arabia", SN: "Senegal", SL: "Sierra Leone", SG: "Singapore",
  SK: "Slovakia", VN: "Vietnam", SI: "Slovenia", SO: "Somalia", ZA: "South Africa",
  ZW: "Zimbabwe", ES: "Spain", SS: "South Sudan", SD: "Sudan", SR: "Suriname",
  SZ: "Eswatini", SE: "Sweden", CH: "Switzerland", SY: "Syria", TJ: "Tajikistan",
  TH: "Thailand", TG: "Togo", TT: "Trinidad & Tobago", AE: "UAE", TN: "Tunisia",
  TR: "Turkey", TM: "Turkmenistan", UG: "Uganda", UA: "Ukraine", MK: "North Macedonia",
  EG: "Egypt", GB: "United Kingdom", TZ: "Tanzania", US: "United States",
  BF: "Burkina Faso", UY: "Uruguay", UZ: "Uzbekistan", VE: "Venezuela",
  YE: "Yemen", ZM: "Zambia",
};

function riskColor(avgScore: number): string {
  if (avgScore >= 70) return "#dc2626";
  if (avgScore >= 50) return "#ea580c";
  if (avgScore >= 30) return "#f59e0b";
  if (avgScore >= 15) return "#84cc16";
  return "#22c55e";
}

function riskColorWithOpacity(avgScore: number, total: number, maxTotal: number): string {
  const base = riskColor(avgScore);
  const volumeAlpha = Math.max(0.45, Math.min(1, total / Math.max(maxTotal * 0.5, 1)));
  return `${base}${Math.round(volumeAlpha * 255).toString(16).padStart(2, "0")}`;
}

interface TooltipData {
  country: string;
  countryCode: string;
  risk: CountryRisk;
  x: number;
  y: number;
}

interface RiskHeatmapProps {
  containers: Container[];
}

export default function RiskHeatmap({ containers }: RiskHeatmapProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([0, 20]);

  const countryRisks = useMemo(
    () => deriveCountryRisk(containers),
    [containers],
  );

  const riskMap = useMemo(() => {
    const m = new Map<string, CountryRisk>();
    for (const cr of countryRisks) m.set(cr.country, cr);
    return m;
  }, [countryRisks]);

  const maxTotal = useMemo(
    () => Math.max(1, ...countryRisks.map((c) => c.totalContainers)),
    [countryRisks],
  );

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z * 1.5, 8)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z / 1.5, 1)), []);
  const handleReset = useCallback(() => {
    setZoom(1);
    setCenter([0, 20]);
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">
              Global Risk Heatmap
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {countryRisks.length} origin countries
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div
            className="rounded-lg overflow-hidden border border-border bg-[hsl(var(--card))]"
            style={{ height: 420 }}
          >
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ scale: 130, center: [0, 20] }}
              width={800}
              height={420}
              style={{ width: "100%", height: "100%" }}
            >
              <ZoomableGroup
                zoom={zoom}
                center={center}
                onMoveEnd={({ coordinates, zoom: z }) => {
                  setCenter(coordinates);
                  setZoom(z);
                }}
              >
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const numId = geo.id as string;
                      const a2 = NUM_TO_A2[numId];
                      const risk = a2 ? riskMap.get(a2) : undefined;

                      return (
                        <Geography
                          key={geo.rpiKey ?? numId}
                          geography={geo}
                          onMouseEnter={(e) => {
                            if (!risk || !a2) return;
                            const rect = (e.currentTarget as SVGPathElement)
                              .closest("svg")
                              ?.getBoundingClientRect();
                            setTooltip({
                              country: COUNTRY_NAMES[a2] ?? a2,
                              countryCode: a2,
                              risk,
                              x: e.clientX - (rect?.left ?? 0),
                              y: e.clientY - (rect?.top ?? 0),
                            });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                          style={{
                            default: {
                              fill: risk
                                ? riskColorWithOpacity(risk.avgRiskScore, risk.totalContainers, maxTotal)
                                : "hsl(var(--muted))",
                              stroke: "hsl(var(--border))",
                              strokeWidth: 0.4,
                              outline: "none",
                            },
                            hover: {
                              fill: risk
                                ? riskColor(risk.avgRiskScore)
                                : "hsl(var(--accent))",
                              stroke: "hsl(var(--foreground))",
                              strokeWidth: 1,
                              outline: "none",
                              cursor: risk ? "pointer" : "default",
                            },
                            pressed: {
                              fill: risk
                                ? riskColor(risk.avgRiskScore)
                                : "hsl(var(--accent))",
                              outline: "none",
                            },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>

            {/* Tooltip */}
            {tooltip && (
              <div
                className="pointer-events-none absolute z-50 rounded-lg border border-border bg-popover px-3 py-2.5 shadow-xl text-xs min-w-[180px]"
                style={{
                  left: Math.min(tooltip.x + 12, 620),
                  top: Math.max(tooltip.y - 80, 8),
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: riskColor(tooltip.risk.avgRiskScore) }}
                  />
                  <span className="font-semibold text-sm">
                    {tooltip.country}
                  </span>
                  <span className="text-muted-foreground">
                    ({tooltip.countryCode})
                  </span>
                </div>
                <div className="space-y-1 text-muted-foreground">
                  <div className="flex justify-between gap-4">
                    <span>Total Containers</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {formatNumber(tooltip.risk.totalContainers)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Critical Count</span>
                    <span className="font-medium text-red-400 tabular-nums">
                      {formatNumber(tooltip.risk.criticalCount)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Risk Rate</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {tooltip.risk.riskRate}%
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Avg Risk Score</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {tooltip.risk.avgRiskScore}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Color legend */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Risk:</span>
              {[
                { label: "Clear", color: "#22c55e" },
                { label: "Low", color: "#84cc16" },
                { label: "Medium", color: "#f59e0b" },
                { label: "High", color: "#ea580c" },
                { label: "Critical", color: "#dc2626" },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1">
                  <div
                    className="h-2.5 w-6 rounded-sm"
                    style={{ background: color }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">
              Opacity scales with container volume
            </span>
          </div>

          {/* Top risky origins table */}
          {countryRisks.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Highest-Risk Origins
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {countryRisks.slice(0, 6).map((cr) => (
                  <div
                    key={cr.country}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: riskColor(cr.avgRiskScore) }}
                      />
                      <span className="font-medium">
                        {COUNTRY_NAMES[cr.country] ?? cr.country}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground tabular-nums">
                      <span>{formatNumber(cr.totalContainers)}</span>
                      <span className="text-red-400">
                        {cr.criticalCount} crit
                      </span>
                      <span>{cr.riskRate}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
