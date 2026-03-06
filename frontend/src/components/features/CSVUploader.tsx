import { useCallback, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  ShieldMinus,
} from "lucide-react";
import { useDashboardStore } from "@/store/dashboardStore";
import { uploadCSV } from "@/services/api";
import { toast } from "sonner";

type Phase =
  | "idle"
  | "reading"
  | "uploading"
  | "processing"
  | "done"
  | "error";

const PHASE_LABELS: Record<Phase, string> = {
  idle: "",
  reading: "Reading CSV file...",
  uploading: "Uploading to Risk Engine...",
  processing: "Running ensemble model...",
  done: "Complete",
  error: "Failed",
};

/* ── Navbar upload button (used by Header) ─────────────────────────────── */

export function NavbarUploadButton() {
  const {
    containers,
    dataStatus,
    setApiData,
    setUploading,
    setUploadError,
    clearApiData,
  } = useDashboardStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);

  const isProcessing =
    phase === "reading" || phase === "uploading" || phase === "processing";
  const hasData = containers.length > 0;

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast.error("Invalid file type", {
          description: "Please upload a .csv file.",
        });
        return;
      }

      setPhase("reading");
      setProgress(10);
      setUploading();

      try {
        setPhase("uploading");
        setProgress(30);

        const progressInterval = setInterval(() => {
          setProgress((p) => Math.min(p + 2, 85));
        }, 200);

        const result = await uploadCSV(file);

        clearInterval(progressInterval);
        setPhase("processing");
        setProgress(90);

        await new Promise((r) => setTimeout(r, 300));

        setProgress(100);
        setPhase("done");
        setApiData(result.containers, result.summary);

        toast.success(
          `Processed ${result.summary.total_containers.toLocaleString()} containers`,
          {
            description: [
              `${result.summary.critical_count} Critical`,
              `${result.summary.low_risk_count} Low Risk`,
              `${result.summary.clear_count} Clear`,
            ].join(" · "),
          },
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setPhase("error");
        setProgress(0);
        setUploadError(msg);
        toast.error("Upload failed", { description: msg });
      }
    },
    [setApiData, setUploading, setUploadError],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
      e.target.value = "";
    },
    [handleUpload],
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={onFileChange}
      />
      <Button
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
        className="gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="hidden sm:inline">{PHASE_LABELS[phase]}</span>
            <span className="sm:hidden">Uploading…</span>
          </>
        ) : (
          <>
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {hasData ? "Re-upload CSV" : "Upload CSV"}
            </span>
            <span className="sm:hidden">Upload</span>
          </>
        )}
      </Button>
    </>
  );
}

/* ── Status banner (shown inline on the dashboard page) ───────────────── */

export default function CSVUploader() {
  const {
    containers,
    batchSummary,
    dataStatus,
    uploadError,
  } = useDashboardStore();

  const hasData = containers.length > 0;
  const isUploading = dataStatus === "uploading";

  // ── Uploading state ─────────────────────────────────────────────────
  if (isUploading && !hasData) {
    return (
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />
            <p className="text-sm font-medium text-blue-400 flex-1">
              Processing CSV through risk engine…
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────
  if (dataStatus === "error" && uploadError) {
    return (
      <Card className="border-red-500/30 bg-red-500/5">
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            <XCircle className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-400 flex-1">
              Upload failed: {uploadError}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Success state (data loaded with full summary) ────────────────────
  if (hasData && batchSummary) {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/[0.04]">
        <CardContent className="py-2.5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Showing predictions for{" "}
              <span className="font-semibold text-foreground">
                {batchSummary.total_containers.toLocaleString()}
              </span>{" "}
              containers
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Data from previous session (no summary available) ───────────────
  if (hasData) {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/[0.04]">
        <CardContent className="py-2.5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Showing predictions for{" "}
              <span className="font-semibold text-foreground">
                {containers.length.toLocaleString()}
              </span>{" "}
              containers
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── No data, no upload in progress → nothing to show ────────────────
  return null;
}
