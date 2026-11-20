// Proves the ported cost model gives exactly the same answers as the original
// estimator script on the ownergc.app landing page (landing/public/index.html),
// by running that script against a pretend web page for many different plans.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { DEFAULT_INPUTS, estimate, money, shortMoney, type EstimateInputs } from "@/lib/estimator";

const html = readFileSync(new URL("../../landing/public/index.html", import.meta.url), "utf8");
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((s) => s.includes("function calc"))!;

const FINISH = { basic: "165", standard: "195", upgraded: "240" };
const REGION = { low: "0.9", average: "1", high: "1.2" };

/** Run the landing page's own script for these inputs and return what it shows. */
function runLandingPage(i: EstimateInputs) {
  const values: Record<string, { value?: string; checked?: boolean; textContent?: string; innerHTML?: string }> = {
    sfMain: { value: String(i.sqft.main) },
    sfUpper: { value: String(i.sqft.upper) },
    sfBase: { value: String(i.sqft.basement) },
    sfGarage: { value: String(i.sqft.garage) },
    sfBonus: { value: String(i.sqft.bonus) },
    finish: { value: FINISH[i.finish] },
    region: { value: REGION[i.region] },
    land: { value: String(i.land) },
    util: { value: String(i.utilities) },
    dMat: { checked: i.diy.materials },
    dFrame: { checked: i.diy.framing },
    dElec: { checked: i.diy.electrical },
    dDry: { checked: i.diy.drywall },
    dPaint: { checked: i.diy.paint },
  };
  const document = {
    getElementById: (id: string) => (values[id] ??= {}),
    querySelectorAll: () => [],
  };
  runInNewContext(script, { window: {}, document });
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.textContent ?? v.innerHTML]));
}

const plans: [string, EstimateInputs][] = [
  ["default example", DEFAULT_INPUTS],
  [
    "upgraded metro with basement",
    {
      ...DEFAULT_INPUTS,
      finish: "upgraded",
      region: "high",
      sqft: { main: 3100, upper: 1400, basement: 3100, garage: 1000, bonus: 500 },
      land: 420000,
      utilities: 5000,
    },
  ],
  [
    "rural ranch, everything DIY",
    {
      ...DEFAULT_INPUTS,
      region: "low",
      sqft: { main: 1800, upper: 0, basement: 0, garage: 600, bonus: 0 },
      land: 60000,
      diy: { materials: true, framing: true, electrical: true, drywall: true, paint: true },
    },
  ],
  [
    "standard, some DIY",
    { ...DEFAULT_INPUTS, finish: "standard", diy: { materials: true, framing: false, electrical: true, drywall: false, paint: true } },
  ],
  [
    "small cabin over $1M land",
    { ...DEFAULT_INPUTS, sqft: { main: 900, upper: 0, basement: 0, garage: 0, bonus: 200 }, land: 1_200_000, utilities: 40000 },
  ],
];

describe("ported cost model matches the landing page estimator", () => {
  it.each(plans)("%s", (_name, inputs) => {
    const page = runLandingPage(inputs);
    const e = estimate(inputs);
    expect(page.hTotal).toBe(money(e.buildCost));
    expect(page.oBuild).toBe(shortMoney(e.buildCost));
    expect(page.oTotal).toBe(shortMoney(e.allIn));
    expect(page.oSave).toBe(shortMoney(e.savings.total));
    expect(page.oWeeks).toBe(`${e.schedule.totalWeeks} wks`);
    expect(page.oMonths).toBe(`about ${e.schedule.months} months`);
    expect(page.oPsf).toBe(e.costPerFinishedSqft === null ? "–" : `${money(e.costPerFinishedSqft)} per finished sf`);
    // Every line-item amount in the page's table, in order.
    const pageAmounts = [...page.lines!.matchAll(/<td class="n">(\$[\d,]+)/g)].map((m) => m[1]);
    const ours = [...e.lines, ...e.softCosts].map((l) => money(l.cost)).concat(money(e.buildCost));
    expect(pageAmounts).toEqual(ours);
  });
});
