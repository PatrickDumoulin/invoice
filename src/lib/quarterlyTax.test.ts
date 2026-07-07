import { describe, it, expect } from "vitest";
import { getQuarterPeriods, computeQuarterData } from "./quarterlyTax";
import type { Invoice } from "@/types";

function inv(overrides: Partial<Invoice>): Invoice {
  return {
    id: crypto.randomUUID(),
    user_id: "u1",
    type: "revenue",
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

// Regression tests for a timezone bug: invoice_date is a SQL DATE ("YYYY-MM-DD"), parsed as
// UTC midnight by `new Date(...)`, while quarter boundaries were built with the local-time
// `new Date(year, month, day)` constructor. In any timezone behind UTC (e.g. America/Toronto),
// an invoice dated exactly on the 1st of a quarter's start month fell in the gap between the
// two and was silently dropped from every quarter. Filtering now compares ISO date strings
// instead of Date objects, which is timezone-independent.
describe("computeQuarterData date-boundary handling", () => {
  const periods = getQuarterPeriods(2026);

  it.each(["2026-01-01", "2026-03-31", "2026-04-01", "2026-06-30", "2026-07-01", "2026-09-30", "2026-10-01", "2026-12-31"])(
    "classifies an invoice dated %s into exactly one quarter",
    (dateStr) => {
      const invoices = [inv({ invoice_date: dateStr })];
      const counts = periods.map((p) => computeQuarterData(invoices, p).invoiceCount);
      expect(counts.reduce((a, b) => a + b, 0)).toBe(1);
    }
  );

  it("assigns each quarter's invoices to the correct quarter index", () => {
    const invoices = [
      inv({ invoice_date: "2026-02-01" }),
      inv({ invoice_date: "2026-05-01" }),
      inv({ invoice_date: "2026-08-01" }),
      inv({ invoice_date: "2026-11-01" }),
    ];
    expect(computeQuarterData(invoices, periods[0]).invoiceCount).toBe(1);
    expect(computeQuarterData(invoices, periods[1]).invoiceCount).toBe(1);
    expect(computeQuarterData(invoices, periods[2]).invoiceCount).toBe(1);
    expect(computeQuarterData(invoices, periods[3]).invoiceCount).toBe(1);
  });
});

describe("computeQuarterData tax registration cutoff (2025-12-01)", () => {
  const q4_2025 = getQuarterPeriods(2025)[3];

  it("excludes CTI/RTI-relevant lines for a Nov 30, 2025 invoice but still counts it in the quarter", () => {
    const data = computeQuarterData([inv({ invoice_date: "2025-11-30", tps_amount: 5, tvq_amount: 8 })], q4_2025);
    expect(data.invoiceCount).toBe(1);
    expect(data.excludedPreRegistration).toBe(1);
    expect(data.line103).toBe(0);
  });

  it("includes a Dec 1, 2025 invoice (registration day) in tax lines", () => {
    const data = computeQuarterData([inv({ invoice_date: "2025-12-01", tps_amount: 5, tvq_amount: 8 })], q4_2025);
    expect(data.excludedPreRegistration).toBe(0);
    expect(data.line103).toBe(5);
  });
});

// Compares local Y/M/D getters rather than toISOString(), which would flip the date in any
// timezone ahead of UTC (subtracting hours from local midnight crosses into the previous day).
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("getQuarterPeriods deadlines", () => {
  it("sets each deadline to the last day of the month after the quarter ends", () => {
    const [q1, q2, q3, q4] = getQuarterPeriods(2026);
    expect(ymd(q1.deadline)).toBe("2026-04-30");
    expect(ymd(q2.deadline)).toBe("2026-07-31");
    expect(ymd(q3.deadline)).toBe("2026-10-31");
    expect(ymd(q4.deadline)).toBe("2027-01-31");
  });
});
