import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined, currency = "CAD"): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// `date` is a plain SQL DATE ("YYYY-MM-DD"), parsed as UTC midnight. Format in UTC too, or a
// timezone behind UTC (e.g. America/Toronto) displays the previous calendar day.
export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

export function formatDateShort(date: string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(date));
}

export async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isAfterDate(dateStr: string | null | undefined, threshold: string): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) >= new Date(threshold);
}

// `dateStr` is a plain SQL DATE ("YYYY-MM-DD"), which `new Date(dateStr).getFullYear()` parses
// as UTC midnight before reading back the *local* year — in any timezone behind UTC this shifts
// Jan 1st into Dec 31st of the previous year. Parse the year directly from the string instead.
export function dateYear(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const year = parseInt(dateStr.slice(0, 4), 10);
  return Number.isNaN(year) ? null : year;
}

export function computeHT(amountCad: number | null, tps: number | null, tvq: number | null): number {
  return (amountCad ?? 0) - (tps ?? 0) - (tvq ?? 0);
}
