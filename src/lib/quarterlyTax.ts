import { computeHT, isAfterDate } from "./utils";
import { TAX_REGISTRATION_DATE, type Invoice } from "@/types";

export const QUARTER_LABELS = [
  "T1 — janvier à mars",
  "T2 — avril à juin",
  "T3 — juillet à septembre",
  "T4 — octobre à décembre",
];

export const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function fmtDate(d: Date): string {
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// invoice_date is a SQL DATE ("YYYY-MM-DD"), which `new Date(...)` parses as UTC midnight.
// Period boundaries below are built as local dates for display purposes, so all filtering
// must compare via this ISO string form instead of Date objects — otherwise an invoice dated
// exactly on a quarter boundary (e.g. April 1st) can fall in the UTC/local gap and be silently
// dropped from every quarter.
export function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export interface QuarterPeriod {
  q: 1 | 2 | 3 | 4;
  label: string;
  start: Date;
  end: Date;
  deadline: Date;
  startISO: string;
  endISO: string;
}

export function getQuarterPeriods(year: number): QuarterPeriod[] {
  return [1, 2, 3, 4].map((q) => {
    const startMonth = (q - 1) * 3;
    const start = new Date(year, startMonth, 1);
    const end = new Date(year, startMonth + 3, 0);
    return {
      q: q as 1 | 2 | 3 | 4,
      label: QUARTER_LABELS[q - 1],
      start,
      end,
      deadline: new Date(year, startMonth + 4, 0),
      startISO: isoLocal(start),
      endISO: isoLocal(end),
    };
  });
}

export interface QuarterData {
  invoiceCount: number;
  excludedPreRegistration: number;
  line101: number;
  line103: number;
  line106: number;
  line109: number;
  line203: number;
  line206: number;
  line209: number;
  total: number;
}

export function computeQuarterData(invoices: Invoice[], period: QuarterPeriod): QuarterData {
  const inQuarter = invoices.filter((i) => {
    if (!i.invoice_date) return false;
    return i.invoice_date >= period.startISO && i.invoice_date <= period.endISO;
  });
  const taxable = inQuarter.filter((i) => isAfterDate(i.invoice_date, TAX_REGISTRATION_DATE));
  const revenues = taxable.filter((i) => i.type === "revenue");
  const expenses = taxable.filter((i) => i.type === "expense");

  const line101 = revenues.reduce((s, i) => s + computeHT(i.amount_cad, i.tps_amount, i.tvq_amount), 0);
  const line103 = revenues.reduce((s, i) => s + (i.tps_amount ?? 0), 0);
  const line106 = expenses.reduce((s, i) => s + (i.tps_amount ?? 0), 0);
  const line109 = line103 - line106;
  const line203 = revenues.reduce((s, i) => s + (i.tvq_amount ?? 0), 0);
  const line206 = expenses.reduce((s, i) => s + (i.tvq_amount ?? 0), 0);
  const line209 = line203 - line206;

  return {
    invoiceCount: inQuarter.length,
    excludedPreRegistration: inQuarter.length - taxable.length,
    line101, line103, line106, line109, line203, line206, line209,
    total: line109 + line209,
  };
}
