// The build schedule, planned vs. where it's heading now, phase by phase.
import { getProjectContext } from "@/lib/project/access";
import { loadTasks } from "@/lib/project/load";
import { buildSchedule } from "@/lib/project/schedule";
import { daysBetween, formatDate, today } from "@/lib/project/validate";
import { hasSavedEstimate } from "@/lib/estimator";
import { ActionForm } from "@/components/project/ActionForm";
import { Badge, Card, Field, Stat, TextLink, buttonClass, inputClass } from "@/components/project/ui";
import { setStartDate } from "../checklist/actions";

export default async function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, project, canEdit } = await getProjectContext(id);
  const { data: p } = await supabase.from("projects").select("start_date").eq("id", project.id).single();
  const tasks = await loadTasks(supabase, project.id);
  const now = today();
  const base = `/dashboard/projects/${project.id}`;
  const start: string | null = p?.start_date ?? null;

  const startForm = canEdit && (
    <ActionForm action={setStartDate} projectId={project.id} resetOnSuccess={false} className="flex flex-wrap items-end gap-2">
      <Field label={start ? "Start date" : "When does (or did) the build start?"}>
        <input name="start_date" type="date" required defaultValue={start ?? now} className={inputClass} />
      </Field>
      <button className={buttonClass}>{start ? "Change" : "Set start date"}</button>
    </ActionForm>
  );

  if (!start) {
    return (
      <Card title="Set your start date">
        <div className="space-y-3 p-4 text-sm text-stone-700">
          <p>The schedule lays out each phase from your start date, using the phase lengths from your estimate.</p>
          {startForm || <p>The project owner hasn&apos;t set a start date yet.</p>}
        </div>
      </Card>
    );
  }

  const schedule = buildSchedule(project.inputs, start, tasks, now);
  const last = schedule[schedule.length - 1];
  const plannedFinish = last.plannedEnd;
  const forecastFinish = last.forecastEnd;
  const slip = daysBetween(plannedFinish, forecastFinish);
  const span = Math.max(1, daysBetween(start, maxDate(plannedFinish, forecastFinish)));
  const pct = (d: string) => `${(Math.max(0, daysBetween(start, d)) / span) * 100}%`;
  const width = (a: string, b: string) => `${(Math.max(1, daysBetween(a, b)) / span) * 100}%`;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Planned finish" value={formatDate(plannedFinish)} />
        <Stat label="Heading for" value={formatDate(forecastFinish)} tone={slip > 7 ? "bad" : slip < 0 ? "good" : undefined} />
        <Stat label={slip >= 0 ? "Behind" : "Ahead"} value={`${Math.abs(Math.round(slip / 7))} wks`} note={`${Math.abs(slip)} days`} tone={slip > 7 ? "bad" : slip < 0 ? "good" : undefined} />
      </section>

      {!hasSavedEstimate(project.inputs) && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-stone-800">
          Phase lengths come from a typical house until you <TextLink href={`/estimate?project=${project.id}`}>save an estimate</TextLink>.
        </p>
      )}
      {tasks.length === 0 && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-stone-800">
          Create your <TextLink href={`${base}/checklist`}>checklist</TextLink> so the schedule can follow real progress.
        </p>
      )}

      <Card title="Phases">
        <ul className="divide-y divide-stone-100">
          {schedule.map((ph) => (
            <li key={ph.key} className="space-y-1 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="font-medium text-stone-900">{ph.name}</span>
                  {ph.status === "done" && <Badge tone="green">Done</Badge>}
                  {ph.status === "in_progress" && <Badge tone="blue">Under way</Badge>}
                  {ph.diy && <Badge tone="green">You</Badge>}
                  {ph.status !== "done" && ph.slipDays > 7 && <Badge tone="red">{Math.round(ph.slipDays / 7)} wks late</Badge>}
                </span>
                <span className="text-stone-600">
                  {formatDate(ph.forecastStart)} – {formatDate(ph.forecastEnd)}
                  {ph.tasksTotal > 0 && (
                    <span className="text-stone-400">
                      {" "}
                      · {ph.tasksDone}/{ph.tasksTotal} tasks
                    </span>
                  )}
                </span>
              </div>
              <div className="relative h-5 rounded bg-stone-100" aria-hidden>
                <div className="absolute top-0 h-2 rounded bg-stone-300" style={{ left: pct(ph.plannedStart), width: width(ph.plannedStart, ph.plannedEnd) }} title="Planned" />
                <div
                  className={`absolute bottom-0 h-2.5 rounded ${ph.status === "done" ? "bg-green-600" : ph.slipDays > 7 ? "bg-red-500" : "bg-amber-500"}`}
                  style={{ left: pct(ph.forecastStart), width: width(ph.forecastStart, ph.forecastEnd) }}
                  title="Actual / forecast"
                />
                {now >= start && now <= maxDate(plannedFinish, forecastFinish) && <div className="absolute top-0 h-full w-px bg-stone-800" style={{ left: pct(now) }} />}
              </div>
            </li>
          ))}
        </ul>
        <p className="border-t border-stone-100 px-4 py-2 text-xs text-stone-500">
          Grey: the original plan. Colored: done or forecast. A phase counts as done when all its checklist tasks are ticked. The black line is today.
        </p>
      </Card>

      {startForm && <Card title="Start date"><div className="p-4">{startForm}</div></Card>}
    </div>
  );
}

function maxDate(a: string, b: string) {
  return a > b ? a : b;
}
