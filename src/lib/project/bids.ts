// Comparing bids for a budget line, and the sub insurance / license tracker.
import { daysBetween } from "./validate";

export type BidRow = {
  id: string;
  sub_id: string;
  budget_line_id: string;
  amount_cents: number;
  status: "requested" | "received" | "awarded" | "declined";
  received_on: string | null;
  due_on: string | null;
  notes: string | null;
  document_id: string | null;
  ai_review: AiReview | null;
  ai_reviewed_at: string | null;
};

export type SubRow = {
  id: string;
  company: string;
  contact_name: string | null;
  trade: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  license_number: string | null;
  license_expires_on: string | null;
  insurance_expires_on: string | null;
};

/** What the AI bid check stores on a bid. */
export type AiReview = {
  summary: string;
  total_cents: number | null;
  line_items: { description: string; amount_cents: number | null }[];
  inclusions: string[];
  exclusions: string[];
  missing_scope: string[];
  questions: string[];
  red_flags: string[];
  model?: string;
};

export type BidComparison = {
  lineId: string;
  bids: (BidRow & { vsBudgetCents: number; vsLowestCents: number; isLowest: boolean })[];
  lowestCents: number | null;
  awarded: BidRow | null;
};

/** Bids for one line, cheapest first, against the budget and each other. Requested-only bids have no price yet. */
export function compareBids(lineId: string, budgetCents: number, bids: BidRow[]): BidComparison {
  const mine = bids.filter((b) => b.budget_line_id === lineId);
  const priced = mine.filter((b) => b.status !== "requested" && b.status !== "declined");
  const lowest = priced.length ? Math.min(...priced.map((b) => b.amount_cents)) : null;
  const order = { awarded: 0, received: 1, requested: 2, declined: 3 } as const;
  return {
    lineId,
    lowestCents: lowest,
    awarded: mine.find((b) => b.status === "awarded") ?? null,
    bids: [...mine]
      .sort((a, b) => order[a.status] - order[b.status] || a.amount_cents - b.amount_cents)
      .map((b) => ({
        ...b,
        vsBudgetCents: b.amount_cents - budgetCents,
        vsLowestCents: lowest === null ? 0 : b.amount_cents - lowest,
        isLowest: lowest !== null && b.amount_cents === lowest && b.status !== "requested" && b.status !== "declined",
      })),
  };
}

export type ExpiryState = "none" | "ok" | "soon" | "expired";
export const EXPIRY_WARNING_DAYS = 30;

export function expiryState(date: string | null, today: string): ExpiryState {
  if (!date) return "none";
  const d = daysBetween(today, date);
  return d < 0 ? "expired" : d <= EXPIRY_WARNING_DAYS ? "soon" : "ok";
}

/** Subs whose license or insurance is missing, expiring or expired. Only subs you have awarded work to need both on file. */
export function subCompliance(sub: SubRow, today: string, hasAwardedWork: boolean) {
  const insurance = expiryState(sub.insurance_expires_on, today);
  const license = expiryState(sub.license_expires_on, today);
  const problems: string[] = [];
  if (insurance === "expired") problems.push("Insurance expired");
  else if (insurance === "soon") problems.push("Insurance expires soon");
  else if (insurance === "none" && hasAwardedWork) problems.push("No insurance on file");
  if (license === "expired") problems.push("License expired");
  else if (license === "soon") problems.push("License expires soon");
  return { insurance, license, problems };
}

/** What each trade usually covers on a new house, so the AI bid check can spot gaps. */
export const SCOPE_HINTS: Record<string, string[]> = {
  site: ["clearing", "excavation", "spoils hauling", "rough and final grading", "driveway base", "erosion control"],
  found: ["footings", "foundation walls", "rebar", "waterproofing", "drain tile", "backfill", "slab", "garage slab", "flatwork"],
  fmat: ["lumber package", "sheathing", "engineered beams/joists", "trusses", "hardware and fasteners", "house wrap", "delivery"],
  flab: ["floor system", "wall framing", "roof framing/truss setting", "sheathing install", "window/door rough openings", "blocking", "stairs"],
  roof: ["tear-off/none", "underlayment", "ice and water shield", "shingles or metal", "flashing", "ridge vent", "drip edge", "dumpster", "warranty"],
  wind: ["windows", "exterior doors", "garage doors", "hardware", "installation", "flashing tape", "delivery"],
  sid: ["siding", "trim", "soffit and fascia", "stone/brick", "caulking", "house wrap repair"],
  insu: ["wall insulation", "attic insulation", "air sealing", "rim joist", "blower door test"],
  plum: ["underground/rough-in", "water and sewer connection", "water heater", "fixture setting", "gas lines", "permit", "inspections"],
  hvac: ["equipment", "ductwork", "registers", "thermostats", "bath and range exhaust", "refrigerant lines", "Manual J sizing", "permit", "startup"],
  elec: ["service panel", "temporary power", "rough wiring", "devices and covers", "fixture install", "smoke/CO detectors", "permit", "inspections"],
  dry: ["hang", "tape and finish", "texture", "corner bead", "moisture-resistant board in wet areas", "cleanup"],
  cab: ["cabinets", "countertops", "templating", "installation", "hardware", "sink cutouts", "backsplash"],
  floor: ["flooring material", "underlayment", "tile setting", "grout", "transitions", "shower pans", "baseboard removal/replacement"],
  trim: ["interior doors", "door hardware", "baseboard and casing", "closet shelving", "stair parts"],
  paint: ["interior walls and ceilings", "trim and doors", "primer", "caulking", "number of coats", "exterior paint/stain"],
  fix: ["plumbing fixtures", "light fixtures", "appliances", "delivery", "installation"],
};
