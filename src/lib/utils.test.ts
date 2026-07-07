import { describe, it, expect } from "vitest";
import { computeHT, dateYear, isAfterDate, formatDate, formatDateShort } from "./utils";

describe("computeHT", () => {
  it("subtracts TPS and TVQ from the CAD amount", () => {
    expect(computeHT(113, 5, 8)).toBe(100);
  });

  it("treats null amounts as zero", () => {
    expect(computeHT(null, null, null)).toBe(0);
    expect(computeHT(100, null, null)).toBe(100);
  });
});

describe("dateYear", () => {
  it("parses the year directly from a YYYY-MM-DD string", () => {
    expect(dateYear("2026-01-01")).toBe(2026);
    expect(dateYear("2026-12-31")).toBe(2026);
  });

  it("returns null for null/undefined/empty input", () => {
    expect(dateYear(null)).toBeNull();
    expect(dateYear(undefined)).toBeNull();
  });
});

describe("isAfterDate", () => {
  it("is true on and after the threshold", () => {
    expect(isAfterDate("2025-12-01", "2025-12-01")).toBe(true);
    expect(isAfterDate("2025-12-02", "2025-12-01")).toBe(true);
  });

  it("is false before the threshold", () => {
    expect(isAfterDate("2025-11-30", "2025-12-01")).toBe(false);
  });

  it("is false for null/undefined", () => {
    expect(isAfterDate(null, "2025-12-01")).toBe(false);
  });
});

describe("formatDate / formatDateShort (UTC-safe)", () => {
  // Regression test for the timezone bug where a SQL DATE ("YYYY-MM-DD"), parsed as UTC
  // midnight and formatted in local time, displayed one calendar day early in any
  // timezone behind UTC (e.g. America/Toronto).
  it("displays the same calendar day the string encodes, regardless of local timezone", () => {
    expect(formatDateShort("2026-06-15")).toBe("2026-06-15");
    expect(formatDateShort("2026-01-01")).toBe("2026-01-01");
    expect(formatDate("2026-06-15")).toContain("15");
  });
});
