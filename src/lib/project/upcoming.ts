// "Coming up": the reminders list. Inspections and tasks due, bid deadlines,
// expiring sub insurance and licenses, selections due. Shown in the app now;
// the same list can drive email or text reminders later.
import { addDays, daysBetween } from "./validate";

export type Upcoming = {
  date: string;
  kind: "inspection" | "task" | "bid" | "insurance" | "license" | "selection" | "draw";
  title: string;
  href: string;
  overdue: boolean;
};

export type UpcomingSources = {
  tasks: { title: string; is_inspection: boolean; due_date: string | null; done_at: string | null }[];
  bids: { due_on: string | null; status: string; subName: string; lineName: string }[];
  subs: { company: string; insurance_expires_on: string | null; license_expires_on: string | null }[];
  selections: { item: string; due_on: string | null; status: string }[];
  extra?: Upcoming[];
};

/** Everything dated within `days` from today, plus anything overdue. */
export function upcoming(src: UpcomingSources, today: string, base: string, days = 30): Upcoming[] {
  const until = addDays(today, days);
  const items: Upcoming[] = [];
  const add = (date: string | null, kind: Upcoming["kind"], title: string, href: string, overdueCounts = true) => {
    if (!date || date > until) return;
    const overdue = date < today;
    if (overdue && !overdueCounts) return;
    items.push({ date, kind, title, href, overdue });
  };
  for (const t of src.tasks) if (!t.done_at) add(t.due_date, t.is_inspection ? "inspection" : "task", t.title, `${base}/checklist`);
  for (const b of src.bids) if (b.status === "requested") add(b.due_on, "bid", `Bid due from ${b.subName} (${b.lineName})`, `${base}/bids`);
  for (const s of src.subs) {
    add(s.insurance_expires_on, "insurance", `${s.company}: insurance ${expiresWord(s.insurance_expires_on!, today)}`, `${base}/subs`);
    add(s.license_expires_on, "license", `${s.company}: license ${expiresWord(s.license_expires_on!, today)}`, `${base}/subs`);
  }
  for (const s of src.selections) if (s.status === "choosing") add(s.due_on, "selection", `Choose ${s.item}`, `${base}/selections`);
  for (const e of src.extra ?? []) if (e.date <= until) items.push(e);
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

function expiresWord(date: string, today: string) {
  const d = daysBetween(today, date);
  return d < 0 ? "expired" : d === 0 ? "expires today" : `expires in ${d} day${d === 1 ? "" : "s"}`;
}
