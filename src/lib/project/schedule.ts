// The build checklist and a schedule that follows real progress. Planned
// dates come from the estimator's phase lengths and the project start date;
// as tasks get ticked off (or don't), later phases move. Pure functions,
// tested in tests/unit/schedule.test.ts.
import { PHASES, estimate, parseEstimateInputs } from "@/lib/estimator";
import { addDays, daysBetween } from "./validate";

export type TaskRow = {
  id: string;
  phase: string;
  key: string | null;
  title: string;
  is_inspection: boolean;
  due_date: string | null;
  done_at: string | null;
  sort_order: number;
};

/** The default checklist, one row per task in the estimator's phases. */
export function defaultTasks() {
  return PHASES.flatMap((p, pi) =>
    p.tasks.map((t, ti) => ({
      phase: p.key,
      key: `${p.key}.${t.key}`,
      title: t.title,
      is_inspection: !!t.inspection,
      sort_order: (pi + 1) * 100 + ti,
    })),
  );
}

export type PhaseStatus = "not_started" | "in_progress" | "done";

export type PhaseSchedule = {
  key: string;
  name: string;
  weeks: number;
  diy: boolean;
  status: PhaseStatus;
  tasksDone: number;
  tasksTotal: number;
  plannedStart: string;
  plannedEnd: string;
  /** Actual start (first task done) and finish (last task done), when known. */
  actualStart: string | null;
  actualEnd: string | null;
  /** Best guess, given progress so far. */
  forecastStart: string;
  forecastEnd: string;
  /** Days behind (+) or ahead (−) of plan at the end of the phase. */
  slipDays: number;
};

/**
 * Lay the phases end to end from the start date. A finished phase uses its
 * real dates. Anything unfinished can't end before today, and each phase
 * starts no earlier than the previous one's (forecast) end.
 */
export function buildSchedule(rawInputs: unknown, startDate: string, tasks: TaskRow[], today: string): PhaseSchedule[] {
  const planned = estimate(parseEstimateInputs(rawInputs)).schedule.phases;
  let prevForecastEnd = startDate;
  return planned.map((p) => {
    const mine = tasks.filter((t) => t.phase === p.key);
    const done = mine.filter((t) => t.done_at);
    const doneDates = done.map((t) => t.done_at!).sort();
    const status: PhaseStatus = mine.length > 0 && done.length === mine.length ? "done" : done.length > 0 ? "in_progress" : "not_started";
    const days = p.weeks * 7;
    const plannedStart = addDays(startDate, p.startWeek * 7);
    const plannedEnd = addDays(plannedStart, days);

    const actualStart = doneDates.length ? minDate(doneDates[0], prevForecastEnd) : null;
    const actualEnd = status === "done" ? doneDates[doneDates.length - 1] : null;

    let forecastStart: string;
    let forecastEnd: string;
    if (status === "done") {
      forecastStart = actualStart!;
      forecastEnd = actualEnd!;
    } else if (status === "in_progress") {
      forecastStart = actualStart!;
      forecastEnd = maxDate(addDays(forecastStart, days), today);
    } else {
      // Starts when the previous phase ends, and never in the past.
      forecastStart = maxDate(prevForecastEnd, today);
      forecastEnd = addDays(forecastStart, days);
    }
    prevForecastEnd = forecastEnd;
    return {
      key: p.key,
      name: p.name,
      weeks: p.weeks,
      diy: p.diy,
      status,
      tasksDone: done.length,
      tasksTotal: mine.length,
      plannedStart,
      plannedEnd,
      actualStart,
      actualEnd,
      forecastStart,
      forecastEnd,
      slipDays: daysBetween(plannedEnd, forecastEnd),
    };
  });
}

function maxDate(...d: string[]) {
  return d.reduce((a, b) => (b > a ? b : a));
}
function minDate(...d: string[]) {
  return d.reduce((a, b) => (b < a ? b : a));
}

/** Phase a draw is tied to is done → that draw's work is complete. */
export function phaseDone(schedule: PhaseSchedule[], key: string): boolean {
  return schedule.find((p) => p.key === key)?.status === "done";
}
