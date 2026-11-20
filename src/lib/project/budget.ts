// Budget vs. committed vs. spent, budget alarms, contingency and the lien
// waiver tracker. Pure functions over rows from the database, so they are easy
// to test (tests/unit/budget.test.ts) and every page shows the same numbers.
import { LINES, estimate, type EstimateInputs } from "@/lib/estimator";
import { sumCents } from "./money";

export type BudgetLineRow = {
  id: string;
  key: string | null;
  division: string;
  name: string;
  budget_cents: number;
  is_diy: boolean;
  sort_order: number;
};

export type ExpenseRow = {
  id: string;
  budget_line_id: string | null;
  spent_on: string;
  vendor: string;
  amount_cents: number;
  waiver_required: boolean;
  document_id: string | null;
};

export type ChangeOrderRow = {
  id: string;
  budget_line_id: string;
  amount_cents: number;
  status: "proposed" | "approved" | "rejected";
};

export type LienWaiverRow = {
  id: string;
  expense_id: string;
  status: "requested" | "received";
  waiver_type: string;
  document_id: string | null;
};

/** An awarded bid for a line (phase 5). */
export type AwardedBid = { budget_line_id: string; amount_cents: number };

export type AlarmLevel = "ok" | "watch" | "over";

export type LineSummary = BudgetLineRow & {
  /** Approved change orders. */
  changesCents: number;
  /** Change orders still waiting for a decision. */
  pendingChangesCents: number;
  /** Awarded bid, if any. */
  bidCents: number | null;
  /** What you've agreed to pay: awarded bid plus approved changes. */
  committedCents: number;
  spentCents: number;
  /** Best guess at what the line will really cost. */
  projectedCents: number;
  /** Budget minus projected. Negative means over. */
  varianceCents: number;
  /** Budget left to spend: budget minus spent. */
  remainingCents: number;
  alarm: AlarmLevel;
  alarmReason: string | null;
};

export const CONTINGENCY_KEY = "cont";
/** Warn when this share of a line's budget is already spent. */
export const WATCH_SHARE = 0.9;

export function summarizeLine(
  line: BudgetLineRow,
  expenses: ExpenseRow[],
  changeOrders: ChangeOrderRow[],
  bids: AwardedBid[] = [],
): LineSummary {
  const mine = <T extends { budget_line_id: string | null }>(rows: T[]) => rows.filter((r) => r.budget_line_id === line.id);
  const cos = mine(changeOrders);
  const changesCents = sumCents(cos.filter((c) => c.status === "approved").map((c) => c.amount_cents));
  const pendingChangesCents = sumCents(cos.filter((c) => c.status === "proposed").map((c) => c.amount_cents));
  const bid = mine(bids);
  const bidCents = bid.length ? sumCents(bid.map((b) => b.amount_cents)) : null;
  const committedCents = (bidCents ?? 0) + changesCents;
  const spentCents = sumCents(mine(expenses).map((e) => e.amount_cents));

  // With a bid, the line will cost the bid plus changes (or more, if you've
  // already spent more). Without one, assume the budget plus changes.
  const plan = bidCents !== null ? bidCents + changesCents : line.budget_cents + changesCents;
  const projectedCents = Math.max(plan, spentCents);
  const varianceCents = line.budget_cents - projectedCents;
  const remainingCents = line.budget_cents - spentCents;

  let alarm: AlarmLevel = "ok";
  let alarmReason: string | null = null;
  if (varianceCents < 0) {
    alarm = "over";
    alarmReason =
      spentCents > plan
        ? "Spending is over budget"
        : bidCents !== null && bidCents > line.budget_cents
          ? "Bid is over budget"
          : "Changes push it over budget";
  } else if (line.budget_cents > 0 && spentCents >= line.budget_cents * WATCH_SHARE) {
    alarm = "watch";
    alarmReason = `${Math.round((spentCents / line.budget_cents) * 100)}% of the budget is spent`;
  } else if (line.budget_cents > 0 && plan + pendingChangesCents > line.budget_cents) {
    alarm = "watch";
    alarmReason = "Pending change orders would put it over";
  }

  return {
    ...line,
    changesCents,
    pendingChangesCents,
    bidCents,
    committedCents,
    spentCents,
    projectedCents,
    varianceCents,
    remainingCents,
    alarm,
    alarmReason,
  };
}

export type BudgetSummary = {
  lines: LineSummary[];
  totals: {
    budgetCents: number;
    changesCents: number;
    committedCents: number;
    spentCents: number;
    projectedCents: number;
    unassignedSpentCents: number;
  };
  contingency: {
    /** The contingency line's budget (0 if the project has none). */
    budgetCents: number;
    /** Overruns on every other line, which contingency has to cover. */
    overrunsCents: number;
    /** Money spent directly from the contingency line. */
    spentCents: number;
    leftCents: number;
  };
  alarms: LineSummary[];
};

export function summarizeBudget(
  lines: BudgetLineRow[],
  expenses: ExpenseRow[],
  changeOrders: ChangeOrderRow[],
  bids: AwardedBid[] = [],
): BudgetSummary {
  const summaries = [...lines]
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map((l) => summarizeLine(l, expenses, changeOrders, bids));
  const cont = summaries.find((l) => l.key === CONTINGENCY_KEY);
  const others = summaries.filter((l) => l !== cont);
  const overrunsCents = sumCents(others.map((l) => Math.max(0, -l.varianceCents)));
  const contSpent = cont?.spentCents ?? 0;
  const contBudget = cont?.budget_cents ?? 0;
  const unassignedSpentCents = sumCents(expenses.filter((e) => !e.budget_line_id).map((e) => e.amount_cents));

  return {
    lines: summaries,
    totals: {
      budgetCents: sumCents(summaries.map((l) => l.budget_cents)),
      changesCents: sumCents(summaries.map((l) => l.changesCents)),
      committedCents: sumCents(summaries.map((l) => l.committedCents)),
      spentCents: sumCents(summaries.map((l) => l.spentCents)) + unassignedSpentCents,
      projectedCents: sumCents(summaries.map((l) => l.projectedCents)) + unassignedSpentCents,
      unassignedSpentCents,
    },
    contingency: {
      budgetCents: contBudget,
      overrunsCents,
      spentCents: contSpent,
      leftCents: contBudget - overrunsCents - contSpent,
    },
    alarms: summaries.filter((l) => l.alarm !== "ok" && l !== cont),
  };
}

/** Budget lines to create from a saved estimate, in cents. */
export function budgetLinesFromEstimate(inputs: EstimateInputs) {
  const e = estimate(inputs);
  return [...e.lines, ...e.softCosts].map((l, i) => ({
    key: l.key,
    division: l.division,
    name: l.name,
    budget_cents: Math.round(l.cost * 100),
    is_diy: l.tag === "diy",
    sort_order: (i + 1) * 10,
  }));
}

/** The trade (sub) usually hired for an estimator line key. */
export function tradeForLineKey(key: string | null): string | null {
  return LINES.find((l) => l.key === key)?.trade ?? null;
}

// ---------------------------------------------------------------------------
// Lien waivers
// ---------------------------------------------------------------------------

export type WaiverState = "not_needed" | "missing" | "requested" | "received";

export function waiverState(expense: ExpenseRow, waivers: LienWaiverRow[]): WaiverState {
  if (!expense.waiver_required) return "not_needed";
  const w = waivers.find((x) => x.expense_id === expense.id);
  if (!w) return "missing";
  return w.status === "received" ? "received" : "requested";
}

/** True when a payment can go in a lender's draw package. */
export function readyForDraw(expense: ExpenseRow, waivers: LienWaiverRow[]): boolean {
  const s = waiverState(expense, waivers);
  return s === "not_needed" || s === "received";
}

export type VendorWaivers = {
  vendor: string;
  paidCents: number;
  coveredCents: number;
  uncoveredCents: number;
  payments: number;
  missing: number;
};

/** Per vendor: how much you've paid and how much is covered by a received waiver. */
export function waiversByVendor(expenses: ExpenseRow[], waivers: LienWaiverRow[]): VendorWaivers[] {
  const map = new Map<string, VendorWaivers>();
  for (const e of expenses) {
    if (!e.waiver_required) continue;
    const name = e.vendor.trim();
    const k = name.toLowerCase();
    const v = map.get(k) ?? { vendor: name, paidCents: 0, coveredCents: 0, uncoveredCents: 0, payments: 0, missing: 0 };
    v.paidCents += e.amount_cents;
    v.payments += 1;
    if (waiverState(e, waivers) === "received") v.coveredCents += e.amount_cents;
    else {
      v.uncoveredCents += e.amount_cents;
      v.missing += 1;
    }
    map.set(k, v);
  }
  return [...map.values()].sort((a, b) => b.uncoveredCents - a.uncoveredCents || a.vendor.localeCompare(b.vendor));
}

export const WAIVER_TYPES = {
  conditional_progress: "Conditional, progress payment",
  unconditional_progress: "Unconditional, progress payment",
  conditional_final: "Conditional, final payment",
  unconditional_final: "Unconditional, final payment",
} as const;

export function isWaiverType(v: unknown): v is keyof typeof WAIVER_TYPES {
  return typeof v === "string" && Object.hasOwn(WAIVER_TYPES, v);
}
