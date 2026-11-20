// The cost model: inputs in, line-item budget, savings, schedule, subs and
// loan draws out. Pure functions with no browser or database code, so the
// same numbers show on the landing page, the estimator and saved projects,
// and the tests in tests/unit/estimator.test.ts can check them directly.
import {
  AREA_WEIGHTS,
  COST_GROUPS,
  DRAWS,
  FINISH_LEVELS,
  GC_FEE_SHARE,
  LINES,
  PHASES,
  REGIONS,
  SELF_SUPPLY_SAVING,
  SOFT_COSTS,
  WEEKS_PER_MONTH,
  type AreaKey,
  type CostGroup,
} from "./data";
import type { EstimateInputs } from "./inputs";

export type LineItem = {
  key: string;
  group: CostGroup;
  division: string;
  name: string;
  /** What a sub would charge for the whole line. */
  gross: number;
  /** What you save on it by doing it yourself or buying materials yourself. */
  saved: number;
  /** What it costs you: gross minus saved. */
  cost: number;
  tag: "diy" | "self-supply" | null;
};

export type ScheduledPhase = {
  key: string;
  name: string;
  /** Week the phase starts, counting from 0. */
  startWeek: number;
  weeks: number;
  diy: boolean;
};

export type Estimate = {
  /** Weighted square footage times the cost per square foot, before any savings. */
  hardCost: number;
  /** Trade lines after DIY and self-supply savings. */
  lines: LineItem[];
  softCosts: LineItem[];
  /** Total cost to build, before land. */
  buildCost: number;
  land: number;
  /** Land plus build. */
  allIn: number;
  finishedSqft: number;
  costPerFinishedSqft: number | null;
  savings: {
    /** Builder overhead and profit you don't pay by being your own GC. */
    gcFee: number;
    /** DIY labor and self-supplied materials. */
    diy: number;
    total: number;
    /** Savings as a share of what a builder would charge (build cost + savings). */
    shareOfBuilderPrice: number;
  };
  groups: { group: CostGroup; cost: number; share: number }[];
  schedule: { phases: ScheduledPhase[]; totalWeeks: number; months: number };
  subs: { key: string; trade: string; doingItYourself: boolean }[];
  draws: { number: number; name: string; share: number; amount: number; description: string }[];
};

export function costPerSqft(inputs: EstimateInputs): number {
  return FINISH_LEVELS[inputs.finish].ratePerSqft * REGIONS[inputs.region].factor;
}

/** Square footage adjusted so unfinished space counts for less. */
export function weightedSqft(inputs: EstimateInputs): number {
  return (Object.keys(AREA_WEIGHTS) as AreaKey[]).reduce((sum, k) => sum + inputs.sqft[k] * AREA_WEIGHTS[k], 0);
}

export function estimate(inputs: EstimateInputs): Estimate {
  const hardCost = weightedSqft(inputs) * costPerSqft(inputs);

  const lines: LineItem[] = LINES.map((L) => {
    const gross = hardCost * L.share;
    let saved = 0;
    let tag: LineItem["tag"] = null;
    if (L.selfSupply && inputs.diy.materials) {
      saved = gross * SELF_SUPPLY_SAVING;
      tag = "self-supply";
    }
    if (L.diy && inputs.diy[L.diy]) {
      saved = gross * (L.diySaving ?? 0);
      tag = "diy";
    }
    return { key: L.key, group: L.group, division: L.division, name: L.name, gross, saved, cost: gross - saved, tag };
  });

  const netHard = sum(lines.map((l) => l.cost));
  const diySaved = sum(lines.map((l) => l.saved));

  const soft = (key: string, division: string, name: string, cost: number): LineItem => ({
    key,
    group: "Soft costs",
    division,
    name,
    gross: cost,
    saved: 0,
    cost,
    tag: null,
  });
  const softCosts = [
    soft("permit", "01", "Permits & impact fees", SOFT_COSTS.permitBase + hardCost * SOFT_COSTS.permitShareOfHard),
    soft("eng", "01", "Engineering & plan changes", SOFT_COSTS.engineering),
    soft("ins", "01", "Builder's risk insurance", hardCost * SOFT_COSTS.insuranceShareOfHard),
    soft("util", "33", "Well, septic & utility hookups", inputs.utilities),
    soft("cont", "01", "Contingency (10%)", netHard * SOFT_COSTS.contingencyShareOfNetHard),
  ];

  const buildCost = netHard + sum(softCosts.map((s) => s.cost));
  const finishedSqft = inputs.sqft.main + inputs.sqft.upper;
  const gcFee = hardCost * GC_FEE_SHARE;
  const totalSavings = gcFee + diySaved;

  const all = [...lines, ...softCosts];
  const groups = COST_GROUPS.map((group) => {
    const cost = sum(all.filter((l) => l.group === group).map((l) => l.cost));
    return { group, cost, share: buildCost ? cost / buildCost : 0 };
  });

  let week = 0;
  const phases: ScheduledPhase[] = PHASES.map((P) => {
    const diy = !!(P.diy && inputs.diy[P.diy]);
    const weeks = P.weeks + (diy ? (P.diyExtraWeeks ?? 0) : 0);
    const phase = { key: P.key, name: P.name, startWeek: week, weeks, diy };
    week += weeks;
    return phase;
  });

  // A trade you mostly do yourself drops off the sub list. Drywall DIY still
  // needs a taper, so it only counts when you save more than half the line.
  const subs = LINES.map((L) => ({
    key: L.key,
    trade: L.trade,
    doingItYourself: !!(L.diy && inputs.diy[L.diy] && (L.diySaving ?? 0) > 0.5),
  }));

  const draws = DRAWS.map((D, i) => ({
    number: i + 1,
    name: D.name,
    share: D.share,
    amount: buildCost * D.share,
    description: D.description,
  }));

  return {
    hardCost,
    lines,
    softCosts,
    buildCost,
    land: inputs.land,
    allIn: buildCost + inputs.land,
    finishedSqft,
    costPerFinishedSqft: finishedSqft ? buildCost / finishedSqft : null,
    savings: {
      gcFee,
      diy: diySaved,
      total: totalSavings,
      shareOfBuilderPrice: buildCost + totalSavings ? totalSavings / (buildCost + totalSavings) : 0,
    },
    groups,
    schedule: { phases, totalWeeks: week, months: Math.round(week / WEEKS_PER_MONTH) },
    subs,
    draws,
  };
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
