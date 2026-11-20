// What the person types into the estimator, plus the code that cleans it up.
// Anything coming from a browser (a form, a link, a saved project) goes
// through parseEstimateInputs first, so the model only ever sees sane numbers.
import { AREA_WEIGHTS, DIY_OPTIONS, FINISH_LEVELS, REGIONS, type AreaKey, type DiyKey, type FinishLevel, type Region } from "./data";

export type EstimateInputs = {
  sqft: Record<AreaKey, number>;
  finish: FinishLevel;
  region: Region;
  /** Land price in dollars. */
  land: number;
  /** Well, septic and utility hookups in dollars. */
  utilities: number;
  diy: Record<DiyKey, boolean>;
};

/** Bumped whenever the shape of saved inputs changes, so old projects can be upgraded. */
export const INPUTS_VERSION = 1;

/**
 * The example on the landing page: a typical new US single-family home. About
 * 2,150 finished sf (the Census median for new homes in 2024-25), two stories,
 * two-car garage, standard finishes. Builds for about $550k before land.
 */
export const DEFAULT_INPUTS: EstimateInputs = {
  sqft: { main: 1150, upper: 1000, basement: 0, garage: 450, bonus: 0 },
  finish: "standard",
  region: "average",
  land: 150000,
  utilities: 25000,
  diy: { materials: false, framing: false, electrical: false, drywall: false, paint: false },
};

export const LIMITS = {
  sqftPerArea: 50_000,
  land: 100_000_000,
  utilities: 10_000_000,
} as const;

const AREA_KEYS = Object.keys(AREA_WEIGHTS) as AreaKey[];
const DIY_KEYS = Object.keys(DIY_OPTIONS) as DiyKey[];

/** A whole, non-negative number no bigger than `max`. Junk becomes 0. */
export function cleanAmount(value: unknown, max: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? parseFloat(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.round(n), max);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pick<T extends string>(value: unknown, allowed: Record<T, unknown>, fallback: T): T {
  return typeof value === "string" && Object.hasOwn(allowed, value) ? (value as T) : fallback;
}

/**
 * Turn anything (a saved project's JSON, a request body) into valid inputs.
 * Missing or bad fields fall back to the defaults; numbers are clamped.
 */
export function parseEstimateInputs(raw: unknown): EstimateInputs {
  const r = isRecord(raw) ? raw : {};
  const sqft = isRecord(r.sqft) ? r.sqft : {};
  const diy = isRecord(r.diy) ? r.diy : {};
  return {
    sqft: Object.fromEntries(
      AREA_KEYS.map((k) => [k, k in sqft ? cleanAmount(sqft[k], LIMITS.sqftPerArea) : DEFAULT_INPUTS.sqft[k]]),
    ) as Record<AreaKey, number>,
    finish: pick(r.finish, FINISH_LEVELS, DEFAULT_INPUTS.finish),
    region: pick(r.region, REGIONS, DEFAULT_INPUTS.region),
    land: "land" in r ? cleanAmount(r.land, LIMITS.land) : DEFAULT_INPUTS.land,
    utilities: "utilities" in r ? cleanAmount(r.utilities, LIMITS.utilities) : DEFAULT_INPUTS.utilities,
    diy: Object.fromEntries(DIY_KEYS.map((k) => [k, diy[k] === true])) as Record<DiyKey, boolean>,
  };
}

/** True when a saved project actually has estimator inputs (phase 1 projects don't). */
export function hasSavedEstimate(raw: unknown): boolean {
  return isRecord(raw) && isRecord(raw.sqft);
}

/** What gets stored in projects.inputs. */
export function toStoredInputs(inputs: EstimateInputs) {
  return { version: INPUTS_VERSION, ...inputs };
}

// ---------------------------------------------------------------------------
// Link format, so an estimate survives a sign-in and can be shared:
// /estimate?main=2400&upper=900&garage=900&finish=basic&region=average&land=150000&util=25000&diy=framing,paint
// ---------------------------------------------------------------------------

const URL_AREA: Record<AreaKey, string> = { main: "main", upper: "upper", basement: "base", garage: "garage", bonus: "bonus" };

export function inputsToSearchParams(inputs: EstimateInputs): URLSearchParams {
  const p = new URLSearchParams();
  for (const k of AREA_KEYS) p.set(URL_AREA[k], String(inputs.sqft[k]));
  p.set("finish", inputs.finish);
  p.set("region", inputs.region);
  p.set("land", String(inputs.land));
  p.set("util", String(inputs.utilities));
  const diy = DIY_KEYS.filter((k) => inputs.diy[k]);
  if (diy.length) p.set("diy", diy.join(","));
  return p;
}

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function getParam(src: ParamSource, key: string): string | undefined {
  if (src instanceof URLSearchParams) return src.get(key) ?? undefined;
  const v = src[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Read inputs from a link. Anything missing uses the default example. */
export function inputsFromSearchParams(src: ParamSource): EstimateInputs {
  const sqft: Record<string, unknown> = {};
  for (const k of AREA_KEYS) {
    const v = getParam(src, URL_AREA[k]);
    if (v !== undefined) sqft[k] = v;
  }
  const raw: Record<string, unknown> = { sqft: { ...DEFAULT_INPUTS.sqft, ...sqft } };
  const finish = getParam(src, "finish");
  const region = getParam(src, "region");
  const land = getParam(src, "land");
  const util = getParam(src, "util");
  if (finish !== undefined) raw.finish = finish;
  if (region !== undefined) raw.region = region;
  if (land !== undefined) raw.land = land;
  if (util !== undefined) raw.utilities = util;
  const diyList = (getParam(src, "diy") ?? "").split(",");
  raw.diy = Object.fromEntries(DIY_KEYS.map((k) => [k, diyList.includes(k)]));
  return parseEstimateInputs(raw);
}
