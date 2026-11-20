// Budget vs. actual, alarms, contingency and lien waivers, checked by hand.
import { describe, expect, it } from "vitest";
import { DEFAULT_INPUTS, estimate } from "@/lib/estimator";
import {
  budgetLinesFromEstimate,
  readyForDraw,
  summarizeBudget,
  summarizeLine,
  waiversByVendor,
  waiverState,
  type BudgetLineRow,
  type ChangeOrderRow,
  type ExpenseRow,
} from "@/lib/project/budget";
import { centsToInput, dollarsToCents, formatCents } from "@/lib/project/money";
import { checkUpload, likePattern, titleFromFilename } from "@/lib/project/documents";
import { addDays, daysBetween, isoDate } from "@/lib/project/validate";

const line = (id: string, budget: number, key: string | null = null): BudgetLineRow => ({
  id,
  key,
  division: "",
  name: id,
  budget_cents: budget,
  is_diy: false,
  sort_order: 0,
});
let n = 0;
const exp = (lineId: string | null, amount: number, vendor = "Acme", waiver = true): ExpenseRow => ({
  id: `e${++n}`,
  budget_line_id: lineId,
  spent_on: "2026-11-20",
  vendor,
  amount_cents: amount,
  waiver_required: waiver,
  document_id: null,
});
const co = (lineId: string, amount: number, status: ChangeOrderRow["status"] = "approved"): ChangeOrderRow => ({
  id: `c${++n}`,
  budget_line_id: lineId,
  amount_cents: amount,
  status,
});

describe("money", () => {
  it("reads what people type", () => {
    expect(dollarsToCents("$12,345.67")).toBe(1234567);
    expect(dollarsToCents("100")).toBe(10000);
    expect(dollarsToCents("0.5")).toBe(50);
    expect(dollarsToCents(".25")).toBe(25);
    expect(dollarsToCents("-50")).toBeNull();
    expect(dollarsToCents("-50", { allowNegative: true })).toBe(-5000);
    expect(dollarsToCents("(1,000)", { allowNegative: true })).toBe(-100000);
    expect(dollarsToCents("abc")).toBeNull();
    expect(dollarsToCents("1.234")).toBeNull();
    expect(dollarsToCents("")).toBeNull();
  });

  it("formats cents", () => {
    expect(formatCents(1234567)).toBe("$12,345.67");
    expect(formatCents(-5000, { whole: true })).toBe("−$50");
    expect(centsToInput(1234567)).toBe("12345.67");
  });
});

describe("one budget line", () => {
  it("with no bid, projects the budget plus approved changes", () => {
    const s = summarizeLine(line("a", 100_00), [exp("a", 40_00)], [co("a", 10_00), co("a", 5_00, "proposed"), co("a", 99_00, "rejected")]);
    expect(s.changesCents).toBe(10_00);
    expect(s.pendingChangesCents).toBe(5_00);
    expect(s.spentCents).toBe(40_00);
    expect(s.projectedCents).toBe(110_00);
    expect(s.varianceCents).toBe(-10_00);
    expect(s.alarm).toBe("over");
    expect(s.alarmReason).toBe("Changes push it over budget");
  });

  it("with an awarded bid, projects the bid plus changes", () => {
    const s = summarizeLine(line("a", 100_00), [], [], [{ budget_line_id: "a", amount_cents: 90_00 }]);
    expect(s.committedCents).toBe(90_00);
    expect(s.projectedCents).toBe(90_00);
    expect(s.varianceCents).toBe(10_00);
    expect(s.alarm).toBe("ok");
  });

  it("flags a bid that is over budget", () => {
    const s = summarizeLine(line("a", 100_00), [], [], [{ budget_line_id: "a", amount_cents: 120_00 }]);
    expect(s.alarm).toBe("over");
    expect(s.alarmReason).toBe("Bid is over budget");
  });

  it("flags spending past the budget", () => {
    const s = summarizeLine(line("a", 100_00), [exp("a", 130_00)], []);
    expect(s.projectedCents).toBe(130_00);
    expect(s.alarm).toBe("over");
    expect(s.alarmReason).toBe("Spending is over budget");
  });

  it("warns at 90% spent", () => {
    expect(summarizeLine(line("a", 100_00), [exp("a", 90_00)], []).alarm).toBe("watch");
    expect(summarizeLine(line("a", 100_00), [exp("a", 89_00)], []).alarm).toBe("ok");
  });

  it("warns when pending change orders would put it over", () => {
    const s = summarizeLine(line("a", 100_00), [], [co("a", 5_00, "proposed")]);
    expect(s.alarm).toBe("watch");
  });

  it("ignores other lines' rows", () => {
    const s = summarizeLine(line("a", 100_00), [exp("b", 500_00)], [co("b", 500_00)]);
    expect(s.spentCents).toBe(0);
    expect(s.alarm).toBe("ok");
  });
});

describe("the whole budget", () => {
  it("adds up, and contingency covers overruns", () => {
    const lines = [line("a", 100_00), line("b", 200_00), line("cont", 50_00, "cont")];
    const s = summarizeBudget(lines, [exp("a", 120_00), exp("cont", 5_00), exp(null, 7_00)], [co("b", -20_00)]);
    expect(s.totals.budgetCents).toBe(350_00);
    expect(s.totals.spentCents).toBe(132_00);
    expect(s.totals.unassignedSpentCents).toBe(7_00);
    expect(s.contingency).toEqual({ budgetCents: 50_00, overrunsCents: 20_00, spentCents: 5_00, leftCents: 25_00 });
    expect(s.alarms.map((l) => l.id)).toEqual(["a"]);
  });
});

describe("seeding the budget from an estimate", () => {
  it("creates one line per estimate line and matches the estimate total to the cent", () => {
    const rows = budgetLinesFromEstimate(DEFAULT_INPUTS);
    const e = estimate(DEFAULT_INPUTS);
    expect(rows).toHaveLength(e.lines.length + e.softCosts.length);
    expect(rows.find((r) => r.key === "cont")).toBeTruthy();
    const total = rows.reduce((a, r) => a + r.budget_cents, 0);
    expect(Math.abs(total - e.buildCost * 100)).toBeLessThan(rows.length);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });
});

describe("lien waivers", () => {
  const e1 = exp("a", 1000_00, "Smith Framing");
  const e2 = exp("a", 500_00, "smith framing ");
  const e3 = exp("a", 50_00, "County", false);
  const waivers = [{ id: "w", expense_id: e1.id, status: "received" as const, waiver_type: "conditional_progress", document_id: null }];

  it("knows which payments are covered", () => {
    expect(waiverState(e1, waivers)).toBe("received");
    expect(waiverState(e2, waivers)).toBe("missing");
    expect(waiverState(e3, waivers)).toBe("not_needed");
    expect(readyForDraw(e1, waivers)).toBe(true);
    expect(readyForDraw(e2, waivers)).toBe(false);
    expect(readyForDraw(e3, waivers)).toBe(true);
  });

  it("groups payments by vendor, ignoring case and spaces", () => {
    expect(waiversByVendor([e1, e2, e3], waivers)).toEqual([
      { vendor: "Smith Framing", paidCents: 1500_00, coveredCents: 1000_00, uncoveredCents: 500_00, payments: 2, missing: 1 },
    ]);
  });
});

describe("uploads", () => {
  it("accepts PDF, JPEG, PNG and HEIC up to 25 MB", () => {
    expect(checkUpload({ name: "a.pdf", type: "application/pdf", size: 10 })).toEqual({ ok: true, contentType: "application/pdf" });
    expect(checkUpload({ name: "IMG_1.HEIC", type: "", size: 10 })).toEqual({ ok: true, contentType: "image/heic" });
    expect(checkUpload({ name: "a.exe", type: "application/octet-stream", size: 10 }).ok).toBe(false);
    expect(checkUpload({ name: "a.pdf", type: "application/pdf", size: 26 * 1024 * 1024 }).ok).toBe(false);
    expect(checkUpload({ name: "a.pdf", type: "application/pdf", size: 0 }).ok).toBe(false);
  });

  it("makes titles and safe search patterns", () => {
    expect(titleFromFilename("Permit 2026.pdf")).toBe("Permit 2026");
    expect(likePattern("50%_off")).toBe("%50\\%\\_off%");
  });
});

describe("dates", () => {
  it("validates and does arithmetic", () => {
    expect(isoDate("2026-02-30")).toBeNull();
    expect(isoDate("2026-11-20")).toBe("2026-11-20");
    expect(addDays("2026-11-20", 14)).toBe("2026-12-04");
    expect(daysBetween("2026-11-20", "2026-12-04")).toBe(14);
  });
});
