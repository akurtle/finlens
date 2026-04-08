import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { MetricFormat } from "@/lib/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMetric(
  value: number | null,
  format: MetricFormat,
  options?: { compact?: boolean; digits?: number }
) {
  if (value === null || Number.isNaN(value)) {
    return "N/A";
  }

  const compact = options?.compact ?? true;
  const digits = options?.digits ?? (format === "percent" ? 1 : 2);

  if (format === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: digits
    }).format(value);
  }

  if (format === "percent") {
    return new Intl.NumberFormat("en-US", {
      style: "percent",
      maximumFractionDigits: digits
    }).format(value);
  }

  if (format === "multiple") {
    return `${value.toFixed(digits)}x`;
  }

  return new Intl.NumberFormat("en-US", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: digits
  }).format(value);
}

export function formatDateLabel(date: string | null) {
  if (!date) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit"
  }).format(new Date(date));
}

export function asUtcIso(date = new Date()) {
  return date.toISOString();
}

export function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
