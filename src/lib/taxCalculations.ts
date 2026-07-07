import { computeHT, isAfterDate } from "./utils";
import { EXPENSE_CATEGORY_LABELS, TAX_REGISTRATION_DATE, type ExpenseCategory, type Invoice } from "@/types";

export interface TaxLineTotals {
  tpsCollected: number;
  tvqCollected: number;
  tpsCTI: number;
  tvqRTI: number;
  tpsNet: number;
  tvqNet: number;
}

// TPS/TVQ collected on revenue and reclaimable (CTI/RTI) on expenses, restricted to invoices
// dated on/after TAX_REGISTRATION_DATE — this is the single source of truth used by the annual
// summary, the annual PDF export, and (independently, per-quarter) the quarterly declaration.
export function computeTaxLineTotals(invoices: Invoice[]): TaxLineTotals {
  const taxable = invoices.filter((i) => isAfterDate(i.invoice_date, TAX_REGISTRATION_DATE));
  const revenues = taxable.filter((i) => i.type === "revenue");
  const expenses = taxable.filter((i) => i.type === "expense");

  const tpsCollected = revenues.reduce((s, i) => s + (i.tps_amount ?? 0), 0);
  const tvqCollected = revenues.reduce((s, i) => s + (i.tvq_amount ?? 0), 0);
  const tpsCTI = expenses.reduce((s, i) => s + (i.tps_amount ?? 0), 0);
  const tvqRTI = expenses.reduce((s, i) => s + (i.tvq_amount ?? 0), 0);

  return {
    tpsCollected,
    tvqCollected,
    tpsCTI,
    tvqRTI,
    tpsNet: tpsCollected - tpsCTI,
    tvqNet: tvqCollected - tvqRTI,
  };
}

export interface CategoryBreakdownEntry {
  cat: string;
  label: string;
  total: number;
  count: number;
  tps: number;
  tvq: number;
}

// Expense totals grouped by category, taxes excluded, with CTI/RTI restricted to invoices
// dated on/after TAX_REGISTRATION_DATE. Sorted by total descending.
export function computeExpenseCategoryBreakdown(invoices: Invoice[]): CategoryBreakdownEntry[] {
  const map = new Map<string, { total: number; count: number; tps: number; tvq: number }>();
  for (const inv of invoices) {
    if (inv.type !== "expense") continue;
    const cat = inv.expense_category ?? "non_categorise";
    const entry = map.get(cat) ?? { total: 0, count: 0, tps: 0, tvq: 0 };
    entry.total += computeHT(inv.amount_cad, inv.tps_amount, inv.tvq_amount);
    entry.count += 1;
    if (isAfterDate(inv.invoice_date, TAX_REGISTRATION_DATE)) {
      entry.tps += inv.tps_amount ?? 0;
      entry.tvq += inv.tvq_amount ?? 0;
    }
    map.set(cat, entry);
  }
  return Array.from(map.entries())
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([cat, data]) => ({
      cat,
      label: EXPENSE_CATEGORY_LABELS[cat as ExpenseCategory] ?? cat,
      ...data,
    }));
}
