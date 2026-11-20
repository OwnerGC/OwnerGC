// Reference data for the cost model, ported from the OwnerGC prototype and the
// ownergc.app landing page. Every number here is a planning assumption, not a
// quote. Change a number here and the estimator, saved projects and tests all
// follow.

export const FINISH_LEVELS = {
  basic: { label: "Basic", ratePerSqft: 165 },
  standard: { label: "Standard", ratePerSqft: 195 },
  upgraded: { label: "Upgraded", ratePerSqft: 240 },
} as const;

export const REGIONS = {
  low: { label: "Low (rural)", factor: 0.9 },
  average: { label: "Average", factor: 1 },
  high: { label: "High (metro)", factor: 1.2 },
} as const;

export type FinishLevel = keyof typeof FINISH_LEVELS;
export type Region = keyof typeof REGIONS;

/**
 * How much each kind of space costs compared with finished living space.
 * Unfinished basement and garage cost about 45% as much per square foot,
 * unfinished bonus space about half.
 */
export const AREA_WEIGHTS = {
  main: 1,
  upper: 1,
  basement: 0.45,
  garage: 0.45,
  bonus: 0.5,
} as const;

export type AreaKey = keyof typeof AREA_WEIGHTS;

export const AREA_LABELS: Record<AreaKey, { label: string; note?: string }> = {
  main: { label: "Main floor" },
  upper: { label: "Upper floor" },
  basement: { label: "Basement", note: "unfinished" },
  garage: { label: "Garage & shop" },
  bonus: { label: "Bonus space", note: "unfinished" },
};

export const DIY_OPTIONS = {
  materials: { label: "Buy materials yourself", note: "Skips sub markup on lumber and sheathing" },
  framing: { label: "Framing labor" },
  electrical: { label: "Electrical wiring", note: "Saves most of the labor; plan on inspection" },
  drywall: { label: "Hang drywall", note: "Sub still tapes and finishes" },
  paint: { label: "Interior paint" },
} as const;

export type DiyKey = keyof typeof DIY_OPTIONS;

/** Self-supplying materials saves this share of the framing-materials line. */
export const SELF_SUPPLY_SAVING = 0.12;

/**
 * What acting as your own general contractor saves: the builder's overhead and
 * profit, taken as a share of hard costs. (The landing page uses 12%; the first
 * prototype used 15%. 12% is the published number.)
 */
export const GC_FEE_SHARE = 0.12;

export type CostGroup = "Site & structure" | "Envelope" | "Systems" | "Interior" | "Soft costs";

export const COST_GROUPS: CostGroup[] = ["Site & structure", "Envelope", "Systems", "Interior", "Soft costs"];

export type LineDef = {
  key: string;
  group: Exclude<CostGroup, "Soft costs">;
  /** Construction division number, the way lenders and bid sheets group costs. */
  division: string;
  name: string;
  /** Share of hard cost. All lines add up to 1. */
  share: number;
  /** The subcontractor or supplier who usually does this work. */
  trade: string;
  /** If set, ticking this DIY option saves `diySaving` of the line. */
  diy?: DiyKey;
  diySaving?: number;
  /** Line that "buy materials yourself" applies to. */
  selfSupply?: boolean;
};

export const LINES: LineDef[] = [
  { key: "site", group: "Site & structure", division: "02", name: "Site prep & excavation", share: 0.05, trade: "Excavator" },
  { key: "found", group: "Site & structure", division: "03", name: "Foundation & flatwork", share: 0.11, trade: "Foundation / concrete" },
  {
    key: "fmat",
    group: "Site & structure",
    division: "06",
    name: "Framing materials & sheathing",
    share: 0.13,
    trade: "Lumber yard",
    selfSupply: true,
  },
  {
    key: "flab",
    group: "Site & structure",
    division: "06",
    name: "Framing labor",
    share: 0.07,
    trade: "Framer",
    diy: "framing",
    diySaving: 1,
  },
  { key: "roof", group: "Envelope", division: "07", name: "Roofing", share: 0.05, trade: "Roofer" },
  { key: "wind", group: "Envelope", division: "08", name: "Windows & exterior doors", share: 0.05, trade: "Window supplier" },
  { key: "sid", group: "Envelope", division: "07", name: "Siding, stone & exterior trim", share: 0.06, trade: "Siding / mason" },
  { key: "insu", group: "Envelope", division: "07", name: "Insulation", share: 0.03, trade: "Insulation" },
  { key: "plum", group: "Systems", division: "22", name: "Plumbing", share: 0.07, trade: "Plumber" },
  { key: "hvac", group: "Systems", division: "23", name: "HVAC", share: 0.06, trade: "HVAC" },
  {
    key: "elec",
    group: "Systems",
    division: "26",
    name: "Electrical",
    share: 0.06,
    trade: "Electrician",
    diy: "electrical",
    diySaving: 0.55,
  },
  {
    key: "dry",
    group: "Interior",
    division: "09",
    name: "Drywall",
    share: 0.05,
    trade: "Drywall tape & finish",
    diy: "drywall",
    diySaving: 0.4,
  },
  { key: "cab", group: "Interior", division: "12", name: "Cabinets & countertops", share: 0.06, trade: "Cabinet / counter shop" },
  { key: "floor", group: "Interior", division: "09", name: "Flooring & tile", share: 0.05, trade: "Flooring / tile" },
  { key: "trim", group: "Interior", division: "06", name: "Interior doors & trim", share: 0.04, trade: "Finish carpenter" },
  { key: "paint", group: "Interior", division: "09", name: "Paint", share: 0.03, trade: "Painter", diy: "paint", diySaving: 0.65 },
  { key: "fix", group: "Interior", division: "11", name: "Fixtures & appliances", share: 0.03, trade: "Appliance supplier" },
];

export const SOFT_COSTS = {
  permitBase: 9000,
  permitShareOfHard: 0.01,
  engineering: 4500,
  insuranceShareOfHard: 0.005,
  contingencyShareOfNetHard: 0.1,
} as const;

export type PhaseDef = {
  key: string;
  name: string;
  weeks: number;
  /** If you DIY this, the phase runs `diyExtraWeeks` longer (evenings and weekends). */
  diy?: DiyKey;
  diyExtraWeeks?: number;
  tasks: { key: string; title: string; inspection?: boolean }[];
};

export const PHASES: PhaseDef[] = [
  {
    key: "permits",
    name: "Permits & plans",
    weeks: 6,
    tasks: [
      { key: "plans", title: "Final plans & engineering" },
      { key: "permit", title: "Building permit issued" },
      { key: "loan", title: "Construction loan closed" },
      { key: "risk", title: "Builder's risk insurance bound" },
    ],
  },
  {
    key: "site",
    name: "Site & excavation",
    weeks: 2,
    tasks: [
      { key: "stake", title: "Lot staked by surveyor" },
      { key: "temp", title: "Temporary power & toilet" },
      { key: "dig", title: "Excavation complete" },
    ],
  },
  {
    key: "found",
    name: "Foundation",
    weeks: 4,
    tasks: [
      { key: "ftg", title: "Footing inspection", inspection: true },
      { key: "walls", title: "Foundation walls poured" },
      { key: "fwall", title: "Foundation wall inspection", inspection: true },
      { key: "back", title: "Waterproofing & backfill" },
      { key: "slab", title: "Basement slab poured" },
    ],
  },
  {
    key: "frame",
    name: "Framing",
    weeks: 6,
    diy: "framing",
    diyExtraWeeks: 5,
    tasks: [
      { key: "floor", title: "Floor system set" },
      { key: "walls", title: "Walls framed" },
      { key: "truss", title: "Roof trusses set" },
      { key: "zip", title: "Sheathing taped" },
    ],
  },
  {
    key: "roof",
    name: "Roof & windows",
    weeks: 3,
    tasks: [
      { key: "roof", title: "Roofing installed" },
      { key: "win", title: "Windows & exterior doors set" },
      { key: "dry", title: "Dried in" },
      { key: "sid", title: "Siding & stone" },
    ],
  },
  {
    key: "rough",
    name: "Rough-ins",
    weeks: 4,
    diy: "electrical",
    diyExtraWeeks: 3,
    tasks: [
      { key: "plum", title: "Plumbing rough" },
      { key: "hvac", title: "HVAC rough" },
      { key: "elec", title: "Electrical rough" },
      { key: "insp", title: "Framing & 4-way rough inspection", inspection: true },
    ],
  },
  {
    key: "insul",
    name: "Insulation",
    weeks: 1,
    tasks: [
      { key: "ins", title: "Insulation installed" },
      { key: "insp", title: "Insulation inspection", inspection: true },
    ],
  },
  {
    key: "dry",
    name: "Drywall",
    weeks: 4,
    diy: "drywall",
    diyExtraWeeks: 3,
    tasks: [
      { key: "hang", title: "Drywall hung" },
      { key: "tape", title: "Tape, mud & texture" },
    ],
  },
  {
    key: "trim",
    name: "Cabinets & trim",
    weeks: 4,
    tasks: [
      { key: "cab", title: "Cabinets & counters" },
      { key: "trim", title: "Interior doors & trim" },
    ],
  },
  {
    key: "finish",
    name: "Flooring & paint",
    weeks: 3,
    diy: "paint",
    diyExtraWeeks: 2,
    tasks: [
      { key: "paint", title: "Paint" },
      { key: "floor", title: "Flooring & tile" },
      { key: "fix", title: "Fixtures & appliances" },
    ],
  },
  {
    key: "final",
    name: "Finals & occupancy",
    weeks: 2,
    tasks: [
      { key: "finals", title: "Final inspections", inspection: true },
      { key: "co", title: "Certificate of occupancy" },
    ],
  },
];

/** A standard five-draw construction loan schedule. Percents add up to 1. */
export const DRAWS = [
  { name: "Foundation", share: 0.15, afterPhase: "found", description: "Footings, walls and slab poured and inspected" },
  { name: "Dry-in", share: 0.3, afterPhase: "roof", description: "Framed, roofed, windows in" },
  { name: "Rough-ins", share: 0.2, afterPhase: "insul", description: "Rough-ins and insulation pass inspection" },
  { name: "Drywall & trim", share: 0.2, afterPhase: "trim", description: "Walls finished, cabinets set" },
  { name: "Final", share: 0.15, afterPhase: "final", description: "Certificate of occupancy issued" },
] as const;

/** Weeks per month used to turn the schedule into "about N months". */
export const WEEKS_PER_MONTH = 4.33;
