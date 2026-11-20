// Checklist, schedule forecasting, bid comparison, sub compliance and reminders.
import { describe, expect, it } from "vitest";
import { DEFAULT_INPUTS, PHASES, toStoredInputs } from "@/lib/estimator";
import { buildSchedule, defaultTasks, type TaskRow } from "@/lib/project/schedule";
import { compareBids, expiryState, subCompliance, type BidRow, type SubRow } from "@/lib/project/bids";
import { upcoming } from "@/lib/project/upcoming";
import { addDays } from "@/lib/project/validate";

const inputs = toStoredInputs(DEFAULT_INPUTS);
const START = "2027-01-04";

function tasksWith(done: Record<string, string>): TaskRow[] {
  return defaultTasks().map((t, i) => ({ ...t, id: `t${i}`, due_date: null, done_at: done[t.key] ?? null }));
}
function doneThrough(phaseKey: string, date: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of PHASES) {
    for (const t of p.tasks) out[`${p.key}.${t.key}`] = date;
    if (p.key === phaseKey) break;
  }
  return out;
}

describe("default checklist", () => {
  it("has every task from every phase, with unique keys and inspections flagged", () => {
    const tasks = defaultTasks();
    expect(tasks).toHaveLength(PHASES.reduce((a, p) => a + p.tasks.length, 0));
    expect(new Set(tasks.map((t) => t.key)).size).toBe(tasks.length);
    expect(tasks.filter((t) => t.is_inspection).map((t) => t.key)).toContain("found.ftg");
  });
});

describe("schedule", () => {
  it("before anything is done and before the start, matches the plan", () => {
    const s = buildSchedule(inputs, START, tasksWith({}), "2026-12-01");
    expect(s[0].plannedStart).toBe(START);
    expect(s[0].forecastStart).toBe(START);
    for (const p of s) expect(p.slipDays).toBe(0);
    expect(s.every((p) => p.status === "not_started")).toBe(true);
  });

  it("slips later phases when today is past a phase's planned end and it isn't done", () => {
    // Permits phase is 6 weeks; it's now 10 weeks after start with nothing done.
    const today = addDays(START, 70);
    const s = buildSchedule(inputs, START, tasksWith({}), today);
    expect(s[0].forecastStart).toBe(today);
    expect(s[0].slipDays).toBe(70);
    expect(s[1].forecastStart).toBe(s[0].forecastEnd);
  });

  it("uses real finish dates, and pulls later phases in when you're ahead", () => {
    const finished = addDays(START, 30); // permits done 12 days early
    const s = buildSchedule(inputs, START, tasksWith(doneThrough("permits", finished)), finished);
    expect(s[0].status).toBe("done");
    expect(s[0].actualEnd).toBe(finished);
    expect(s[0].slipDays).toBe(-12);
    expect(s[1].forecastStart).toBe(finished);
    expect(s[1].slipDays).toBe(-12);
  });

  it("marks a phase in progress when some of its tasks are done", () => {
    const s = buildSchedule(inputs, START, tasksWith({ "permits.plans": START }), START);
    expect(s[0].status).toBe("in_progress");
    expect(s[0].tasksDone).toBe(1);
  });
});

const bid = (id: string, amount: number, status: BidRow["status"] = "received", line = "L"): BidRow => ({
  id,
  sub_id: "s",
  budget_line_id: line,
  amount_cents: amount,
  status,
  received_on: null,
  due_on: null,
  notes: null,
  document_id: null,
  ai_review: null,
  ai_reviewed_at: null,
});

describe("bid comparison", () => {
  it("ranks bids and compares with the budget and the lowest bid", () => {
    const c = compareBids("L", 100_00, [bid("a", 120_00), bid("b", 90_00), bid("c", 50_00, "declined"), bid("d", 0, "requested"), bid("x", 1, "received", "other")]);
    expect(c.lowestCents).toBe(90_00);
    expect(c.bids.map((b) => b.id)).toEqual(["b", "a", "d", "c"]);
    expect(c.bids[0]).toMatchObject({ isLowest: true, vsBudgetCents: -10_00, vsLowestCents: 0 });
    expect(c.bids[1]).toMatchObject({ isLowest: false, vsBudgetCents: 20_00, vsLowestCents: 30_00 });
    expect(c.awarded).toBeNull();
  });

  it("finds the awarded bid", () => {
    expect(compareBids("L", 0, [bid("a", 5, "awarded")]).awarded?.id).toBe("a");
  });
});

describe("sub insurance and license tracker", () => {
  const sub = (ins: string | null, lic: string | null): SubRow => ({
    id: "s",
    company: "Acme",
    contact_name: null,
    trade: "Framer",
    phone: null,
    email: null,
    notes: null,
    license_number: null,
    license_expires_on: lic,
    insurance_expires_on: ins,
  });
  it("warns 30 days ahead and when expired", () => {
    expect(expiryState("2026-12-15", "2026-11-20")).toBe("soon");
    expect(expiryState("2027-03-01", "2026-11-20")).toBe("ok");
    expect(expiryState("2026-11-19", "2026-11-20")).toBe("expired");
    expect(expiryState(null, "2026-11-20")).toBe("none");
  });
  it("needs insurance on file for subs with awarded work", () => {
    expect(subCompliance(sub(null, null), "2026-11-20", true).problems).toEqual(["No insurance on file"]);
    expect(subCompliance(sub(null, null), "2026-11-20", false).problems).toEqual([]);
    expect(subCompliance(sub("2026-11-01", "2026-12-01"), "2026-11-20", true).problems).toEqual(["Insurance expired", "License expires soon"]);
  });
});

describe("coming up", () => {
  it("lists dated things in the next 30 days plus overdue ones, in date order", () => {
    const list = upcoming(
      {
        tasks: [
          { title: "Footing inspection", is_inspection: true, due_date: "2026-11-25", done_at: null },
          { title: "Done already", is_inspection: false, due_date: "2026-11-21", done_at: "2026-11-20" },
          { title: "Far away", is_inspection: false, due_date: "2027-06-01", done_at: null },
          { title: "Late", is_inspection: false, due_date: "2026-11-01", done_at: null },
        ],
        bids: [{ due_on: "2026-11-22", status: "requested", subName: "Bob's Plumbing", lineName: "Plumbing" }],
        subs: [{ company: "Acme", insurance_expires_on: "2026-12-01", license_expires_on: null }],
        selections: [{ item: "Kitchen tile", due_on: "2026-12-10", status: "choosing" }],
      },
      "2026-11-20",
      "/p",
    );
    expect(list.map((i) => i.title)).toEqual([
      "Late",
      "Bid due from Bob's Plumbing (Plumbing)",
      "Footing inspection",
      "Acme: insurance expires in 11 days",
      "Choose Kitchen tile",
    ]);
    expect(list[0].overdue).toBe(true);
    expect(list[2].kind).toBe("inspection");
  });
});
