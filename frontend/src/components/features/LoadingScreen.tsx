import { useEffect, useState, useRef } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Ship } from "lucide-react";

const STAGES = [
  { pct: 15, label: "Connecting to server…" },
  { pct: 35, label: "Loading container data…" },
  { pct: 55, label: "Loading inspection queue…" },
  { pct: 75, label: "Processing risk models…" },
  { pct: 90, label: "Preparing dashboard…" },
];

interface LoadingScreenProps {
  finished: boolean;
}

export default function LoadingScreen({ finished }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [stageIdx, setStageIdx] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const [hidden, setHidden] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Simulate incremental progress through stages
  useEffect(() => {
    if (finished) return;

    intervalRef.current = setInterval(() => {
      setStageIdx((prev) => {
        const next = Math.min(prev + 1, STAGES.length - 1);
        setProgress(STAGES[next].pct);
        return next;
      });
    }, 600);

    // Kick off the first stage immediately
    setProgress(STAGES[0].pct);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [finished]);

  // When finished, jump to 100% then fade out
  useEffect(() => {
    if (!finished) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setProgress(100);
    const fadeTimer = setTimeout(() => setFadeOut(true), 400);
    const hideTimer = setTimeout(() => setHidden(true), 900);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [finished]);

  if (hidden) return null;

  const label = finished
    ? "Ready!"
    : STAGES[stageIdx]?.label ?? "Loading…";

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-500",
        fadeOut && "opacity-0 pointer-events-none",
      )}
    >
      <div className="flex flex-col items-center gap-6 w-80">
        {/* Logo / icon */}
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/20 shadow-lg shadow-cyan-500/25">
            <Ship className="h-8 w-8 text-white" />
          </div>
          {!finished && (
            <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background bg-amber-400 animate-pulse" />
          )}
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">SmartContainer Risk Engine</h2>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>

        {/* Progress bar */}
        <div className="w-full space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-center text-xs tabular-nums font-medium text-muted-foreground">
            {progress}%
          </p>
        </div>
      </div>
    </div>
  );
}
