import { describe, it, expect } from "vitest";
import { computeTaxLineTotals, computeExpenseCategoryBreakdown } from "./taxCalculations";
import type { Invoice } from "@/types";

function inv(overrides: Partial<Invoice>): Invoice {
  return {
    id: crypto.randomUUID(),
    user_id: "u1",
    type: "expense",
    company_name: null,
    invoice_date: "2026-01-15",
    amount: null,
    currency: "CAD",
    description: null,
    file_name: null,
    file_path: null,
    status: "processed",
    raw_extraction: null,
    created_at: "2026-01-15T00:00:00Z",
    updated_at: "2026-01-15T00:00:00Z",
    amount_cad: 113,
    exchange_rate: 1,
    file_hash: null,
    tps_amount: 5,
    tvq_amount: 8,
    expense_category: null,
    is_partnership: false,
    partnership_reimbursed: 0,
    expense_owner: null,
    ...overrides,
  };
}

describe("computeTaxLineTotals", () => {
  it("nets TPS/TVQ collected on revenue against CTI/RTI on expenses", () => {
    const invoices = [
      inv({ type: "revenue", tps_amount: 10, tvq_amount: 20 }),
      inv({ type: "expense", tps_amount: 3, tvq_amount: 6 }),
    ];
    const totals = computeTaxLineTotals(invoices);
    expect(totals.tpsCollected).toBe(10);
    expect(totals.tvqCollected).toBe(20);
    expect(totals.tpsCTI).toBe(3);
    expect(totals.tvqRTI).toBe(6);
    expect(totals.tpsNet).toBe(7);
    expect(totals.tvqNet).toBe(14);
  });

  it("excludes invoices dated before the tax registration date (2025-12-01)", () => {
    const invoices = [
      inv({ type: "revenue", invoice_date: "2025-11-30", tps_amount: 100, tvq_amount: 100 }),
      inv({ type: "revenue", invoice_date: "2025-12-01", tps_amount: 5, tvq_amount: 8 }),
    ];
    const totals = computeTaxLineTotals(invoices);
    expect(totals.tpsCollected).toBe(5);
    expect(totals.tvqCollected).toBe(8);
  });

  it("returns all zeros for an empty list", () => {
    const totals = computeTaxLineTotals([]);
    expect(totals).toEqual({
      tpsCollected: 0, tvqCollected: 0, tpsCTI: 0, tvqRTI: 0, tpsNet: 0, tvqNet: 0,
    });
  });
});

describe("computeExpenseCategoryBreakdown", () => {
  it("groups expenses by category, HT, sorted by total descending", () => {
    const invoices = [
      inv({ type: "expense", expense_category: "logiciels", amount_cad: 113, tps_amount: 5, tvq_amount: 8 }),
      inv({ type: "expense", expense_category: "logiciels", amount_cad: 226, tps_amount: 10, tvq_amount: 16 }),
      inv({ type: "expense", expense_category: "marketing", amount_cad: 50, tps_amount: 2, tvq_amount: 3 }),
      inv({ type: "revenue", amount_cad: 1000, tps_amount: 50, tvq_amount: 80 }), // ignored, not an expense
    ];
    const breakdown = computeExpenseCategoryBreakdown(invoices);
    expect(breakdown).toHaveLength(2);
    expect(breakdown[0].cat).toBe("logiciels");
    expect(breakdown[0].count).toBe(2);
    expect(breakdown[0].total).toBeCloseTo(100 + 200, 5);
    expect(breakdown[1].cat).toBe("marketing");
  });

  it("falls back to 'non_categorise' when expense_category is null", () => {
    const breakdown = computeExpenseCategoryBreakdown([inv({ type: "expense", expense_category: null })]);
    expect(breakdown[0].cat).toBe("non_categorise");
  });

  it("excludes pre-registration CTI/RTI but still counts the expense total", () => {
    const breakdown = computeExpenseCategoryBreakdown([
      inv({ type: "expense", invoice_date: "2025-11-30", expense_category: "bureau", amount_cad: 113, tps_amount: 5, tvq_amount: 8 }),
    ]);
    expect(breakdown[0].total).toBeCloseTo(100, 5);
    expect(breakdown[0].tps).toBe(0);
    expect(breakdown[0].tvq).toBe(0);
  });
});
