// Checks of the cost model against numbers worked out by hand.
import { describe, expect, it } from "vitest";
import {
  DEFAULT_INPUTS,
  DRAWS,
  LINES,
  PHASES,
  estimate,
  inputsFromSearchParams,
  inputsToSearchParams,
  money,
  parseEstimateInputs,
  shortMoney,
  type EstimateInputs,
} from "@/lib/estimator";

const withInputs = (patch: Partial<EstimateInputs>): EstimateInputs => ({ ...DEFAULT_INPUTS, ...patch });
const withDiy = (diy: Partial<EstimateInputs["diy"]>) => withInputs({ diy: { ...DEFAULT_INPUTS.diy, ...diy } });

describe("reference data", () => {
  it("trade line shares add up to 100% of hard cost", () => {
    expect(LINES.reduce((a, l) => a + l.share, 0)).toBeCloseTo(1, 10);
  });

  it("loan draws add up to 100%", () => {
    expect(DRAWS.reduce((a, d) => a + d.share, 0)).toBeCloseTo(1, 10);
  });

  it("every draw is tied to a real phase", () => {
    const keys = PHASES.map((p) => p.key);
    for (const d of DRAWS) expect(keys).toContain(d.afterPhase);
  });

  it("line keys are unique (saved budget lines will be keyed on them)", () => {
    expect(new Set(LINES.map((l) => l.key)).size).toBe(LINES.length);
  });
});

describe("the default example (typical new home on the landing page)", () => {
  const e = estimate(DEFAULT_INPUTS);
  // (1150 + 1000 + 450 garage x 0.45) sf x $195/sf (standard) x 1.0 region
  const hard = (1150 + 1000 + 450 * 0.45) * 195;

  it("prices hard cost from weighted square footage", () => {
    expect(e.hardCost).toBeCloseTo(hard, 6); // $458,737.50
  });

  it("adds soft costs: permits, engineering, insurance, utilities, 10% contingency", () => {
    const soft = Object.fromEntries(e.softCosts.map((s) => [s.key, s.cost]));
    expect(soft.permit).toBeCloseTo(9000 + hard * 0.01, 6);
    expect(soft.eng).toBe(4500);
    expect(soft.ins).toBeCloseTo(hard * 0.005, 6);
    expect(soft.util).toBe(25000);
    expect(soft.cont).toBeCloseTo(hard * 0.1, 6);
  });

  it("builds for about $550k: $700k all-in, $55k saved, 39 weeks", () => {
    expect(money(e.buildCost)).toBe("$549,992");
    expect(shortMoney(e.allIn)).toBe("$700k");
    expect(shortMoney(e.savings.total)).toBe("$55k");
    expect(e.schedule.totalWeeks).toBe(39);
    expect(e.schedule.months).toBe(9);
  });

  it("works out cost per finished square foot from main + upper floors only", () => {
    expect(e.finishedSqft).toBe(2150);
    expect(e.costPerFinishedSqft).toBeCloseTo(e.buildCost / 2150, 6);
  });

  it("group totals add up to the build cost", () => {
    expect(e.groups.reduce((a, g) => a + g.cost, 0)).toBeCloseTo(e.buildCost, 6);
    expect(e.groups.reduce((a, g) => a + g.share, 0)).toBeCloseTo(1, 10);
  });

  it("draw amounts add up to the build cost", () => {
    expect(e.draws.map((d) => d.number)).toEqual([1, 2, 3, 4, 5]);
    expect(e.draws.reduce((a, d) => a + d.amount, 0)).toBeCloseTo(e.buildCost, 6);
  });

  it("schedules phases back to back", () => {
    let week = 0;
    for (const p of e.schedule.phases) {
      expect(p.startWeek).toBe(week);
      week += p.weeks;
    }
    expect(week).toBe(39);
  });

  it("lists a sub for every trade and nothing DIY", () => {
    expect(e.subs).toHaveLength(LINES.length);
    expect(e.subs.some((s) => s.doingItYourself)).toBe(false);
  });
});

describe("finish level, region and space types", () => {
  it("multiplies cost per square foot by the region factor", () => {
    const e = estimate(withInputs({ finish: "upgraded", region: "high" }));
    expect(e.hardCost).toBeCloseTo((1150 + 1000 + 450 * 0.45) * 240 * 1.2, 6);
  });

  it("counts basement and garage at 45% and bonus space at 50%", () => {
    const e = estimate(withInputs({ sqft: { main: 0, upper: 0, basement: 1000, garage: 1000, bonus: 1000 } }));
    expect(e.hardCost).toBeCloseTo((450 + 450 + 500) * 195, 6);
    expect(e.costPerFinishedSqft).toBeNull();
  });

  it("an empty plan costs only the fixed soft costs plus land", () => {
    const e = estimate(withInputs({ sqft: { main: 0, upper: 0, basement: 0, garage: 0, bonus: 0 }, land: 0, utilities: 0 }));
    expect(e.buildCost).toBe(9000 + 4500);
    expect(e.savings.total).toBe(0);
  });
});

describe("doing work yourself", () => {
  const base = estimate(DEFAULT_INPUTS);
  const line = (e: ReturnType<typeof estimate>, key: string) => e.lines.find((l) => l.key === key)!;

  it.each([
    ["framing", "flab", 1],
    ["electrical", "elec", 0.55],
    ["drywall", "dry", 0.4],
    ["paint", "paint", 0.65],
  ] as const)("%s saves its share of the %s line", (diy, key, saving) => {
    const e = estimate(withDiy({ [diy]: true }));
    const l = line(e, key);
    expect(l.tag).toBe("diy");
    expect(l.saved).toBeCloseTo(l.gross * saving, 6);
    expect(e.savings.diy).toBeCloseTo(l.saved, 6);
    expect(e.savings.total).toBeCloseTo(base.savings.total + l.saved, 6);
  });

  it("buying materials yourself saves 12% of framing materials", () => {
    const e = estimate(withDiy({ materials: true }));
    const l = line(e, "fmat");
    expect(l.tag).toBe("self-supply");
    expect(l.saved).toBeCloseTo(l.gross * 0.12, 6);
  });

  it("contingency is 10% of trade costs after savings", () => {
    const e = estimate(withDiy({ framing: true }));
    const cont = e.softCosts.find((s) => s.key === "cont")!;
    expect(cont.cost).toBeCloseTo(e.lines.reduce((a, l) => a + l.cost, 0) * 0.1, 6);
  });

  it("DIY phases run longer: framing +5, rough-ins +3, drywall +3, paint +2 weeks", () => {
    const all = estimate(withDiy({ framing: true, electrical: true, drywall: true, paint: true }));
    expect(all.schedule.totalWeeks).toBe(39 + 5 + 3 + 3 + 2);
    expect(all.schedule.phases.filter((p) => p.diy).map((p) => p.key)).toEqual(["frame", "rough", "dry", "finish"]);
  });

  it("drops a trade from the sub list only when you do most of it", () => {
    const e = estimate(withDiy({ framing: true, drywall: true }));
    const mine = e.subs.filter((s) => s.doingItYourself).map((s) => s.key);
    expect(mine).toEqual(["flab"]); // drywall DIY still needs a taper
  });
});

describe("cleaning up inputs", () => {
  it("fills in defaults for missing fields", () => {
    expect(parseEstimateInputs(undefined)).toEqual(DEFAULT_INPUTS);
    expect(parseEstimateInputs({})).toEqual(DEFAULT_INPUTS);
  });

  it("turns junk and negative numbers into 0 and rounds", () => {
    const i = parseEstimateInputs({ sqft: { main: "abc", upper: -50, basement: "1200.6", garage: null, bonus: Infinity }, land: "-1" });
    expect(i.sqft).toEqual({ main: 0, upper: 0, basement: 1201, garage: 0, bonus: 0 });
    expect(i.land).toBe(0);
  });

  it("caps absurd values", () => {
    const i = parseEstimateInputs({ sqft: { main: 1e12 }, land: 1e15, utilities: 1e15 });
    expect(i.sqft.main).toBe(50_000);
    expect(i.land).toBe(100_000_000);
    expect(i.utilities).toBe(10_000_000);
  });

  it("rejects unknown finish levels and regions", () => {
    const i = parseEstimateInputs({ finish: "gold", region: "__proto__" });
    expect(i.finish).toBe("standard");
    expect(i.region).toBe("average");
  });

  it("only accepts real true for DIY flags, and ignores unknown keys", () => {
    const i = parseEstimateInputs({ diy: { framing: "yes", paint: true, roofing: true } }) as unknown as Record<string, unknown>;
    expect(i.diy).toEqual({ ...DEFAULT_INPUTS.diy, paint: true });
    expect(Object.keys(i)).toEqual(Object.keys(DEFAULT_INPUTS));
  });

  it("round-trips through a link", () => {
    const original = withInputs({
      sqft: { main: 1800, upper: 0, basement: 1800, garage: 600, bonus: 300 },
      finish: "standard",
      region: "low",
      land: 90000,
      utilities: 18000,
      diy: { ...DEFAULT_INPUTS.diy, electrical: true, paint: true },
    });
    const params = inputsToSearchParams(original);
    expect(params.get("diy")).toBe("electrical,paint");
    expect(inputsFromSearchParams(new URLSearchParams(params.toString()))).toEqual(original);
    expect(inputsFromSearchParams(Object.fromEntries(params))).toEqual(original);
  });

  it("an empty link gives the default example", () => {
    expect(inputsFromSearchParams(new URLSearchParams())).toEqual(DEFAULT_INPUTS);
  });
});
