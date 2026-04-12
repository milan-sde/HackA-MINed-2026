import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RiskLevel } from "@/types";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const RISK_COLORS: Record<RiskLevel, string> = {
  Critical: "#EF4444",
  "Low Risk": "#F59E0B",
  Clear: "#10B981",
};

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";

  const abs = Math.abs(value);
  const maxFractionDigits = abs >= 100 || Number.isInteger(value) ? 0 : 1;

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}

export function formatPct(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(digits)}%`;
}
