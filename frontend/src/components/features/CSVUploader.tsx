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

interface CSVUploaderProps {
  compact?: boolean;
}

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

export default function CSVUploader({ compact = false }: CSVUploaderProps) {
  const {
    containers,
    batchSummary,
    dataStatus,
    uploadError,
    setApiData,
    setUploading,
    setUploadError,
    clearApiData,
  } = useDashboardStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const hasData = containers.length > 0;

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast.error("Invalid file type", {
          description: "Please upload a .csv file.",
        });
        return;
      }

      setFileName(file.name);
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

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragOver(false), []);

  const reset = useCallback(() => {
    setPhase("idle");
    setProgress(0);
    setFileName(null);
    clearApiData();
  }, [clearApiData]);

  const isProcessing =
    phase === "reading" || phase === "uploading" || phase === "processing";

  // ── Success state (data loaded) ──────────────────────────────────────
  if (hasData && phase === "done" && batchSummary) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/10">
        <CardContent className={compact ? "py-4" : "py-6"}>
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-emerald-500/15 p-2.5 shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">
                Processed{" "}
                <span className="text-emerald-400">
                  {batchSummary.total_containers.toLocaleString()}
                </span>{" "}
                containers
              </p>

              {fileName && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Source: {fileName}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge
                  variant="outline"
                  className="gap-1.5 border-red-500/30 text-red-400"
                >
                  <ShieldAlert className="h-3 w-3" />
                  {batchSummary.critical_count} Critical
                </Badge>
                <Badge
                  variant="outline"
                  className="gap-1.5 border-amber-500/30 text-amber-400"
                >
                  <ShieldMinus className="h-3 w-3" />
                  {batchSummary.low_risk_count} Low Risk
                </Badge>
                <Badge
                  variant="outline"
                  className="gap-1.5 border-emerald-500/30 text-emerald-400"
                >
                  <ShieldCheck className="h-3 w-3" />
                  {batchSummary.clear_count} Clear
                </Badge>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => {
                reset();
                setTimeout(() => fileInputRef.current?.click(), 50);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Re-upload
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={onFileChange}
          />
        </CardContent>
      </Card>
    );
  }

  // ── If data exists from a previous session but phase is idle ─────────
  if (hasData && phase !== "done") {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/10">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <p className="text-sm text-muted-foreground flex-1">
              Showing predictions for{" "}
              <span className="font-semibold text-foreground">
                {containers.length.toLocaleString()}
              </span>{" "}
              containers
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload new CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={onFileChange}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Drop zone (idle / processing / error) ────────────────────────────
  const py = compact ? "py-10" : "py-16";

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={onFileChange}
      />

      <Card
        className={`border-2 border-dashed transition-all duration-200 ${
          isDragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : phase === "error"
              ? "border-destructive/50"
              : "border-border hover:border-muted-foreground/40"
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <CardContent
          className={`flex flex-col items-center justify-center ${py} text-center`}
        >
          {/* ── Processing ─────────────────────────────────────────── */}
          {isProcessing && (
            <>
              <div className="relative mb-5">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
                <FileSpreadsheet className="h-5 w-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>

              <p className="text-base font-semibold">
                {PHASE_LABELS[phase]}
              </p>

              {fileName && (
                <p className="text-xs text-muted-foreground mt-1">
                  {fileName}
                </p>
              )}

              <div className="w-full max-w-xs mt-4">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">
                  {progress}%
                </p>
              </div>
            </>
          )}

          {/* ── Error ──────────────────────────────────────────────── */}
          {phase === "error" && (
            <>
              <div className="rounded-full bg-destructive/20 p-3 mb-4">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>

              <p className="text-base font-semibold text-destructive">
                Upload failed
              </p>

              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                {uploadError}
              </p>

              <div className="flex gap-2 mt-4">
                <Button
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <RotateCcw className="h-4 w-4" />
                  Try again
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPhase("idle");
                    setFileName(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}

          {/* ── Idle (drop zone) ───────────────────────────────────── */}
          {phase === "idle" && (
            <>
              <div className="rounded-full bg-muted p-4 mb-4">
                {isDragOver ? (
                  <Upload className="h-8 w-8 text-primary animate-bounce" />
                ) : (
                  <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
                )}
              </div>

              <p className="text-base font-semibold">
                {isDragOver ? "Drop your CSV here" : "Upload Container Data"}
              </p>

              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Drag & drop a CSV file here, or click the button below. The
                file is sent to the SmartContainer Risk Engine for batch
                scoring.
              </p>

              <Button
                className="mt-5 gap-2"
                size="lg"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Select CSV file
              </Button>

              {!compact && (
                <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Max 10,000 rows
                  </span>
                  <span>
                    Required: Container_ID, Declared_Value,
                    Declared_Weight, Measured_Weight, Origin_Country,
                    HS_Code, Importer_ID, Exporter_ID
                  </span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
