// The build checklist: every phase's tasks, inspections flagged, due dates.
import { getProjectContext } from "@/lib/project/access";
import { loadTasks } from "@/lib/project/load";
import { PHASES } from "@/lib/estimator";
import { daysBetween, formatDate, today } from "@/lib/project/validate";
import { ActionForm } from "@/components/project/ActionForm";
import { Badge, Card, Field, TextLink, ViewerNote, buttonClass, dangerLinkClass, inputClass, secondaryButtonClass } from "@/components/project/ui";
import { addTask, deleteTask, seedChecklist, toggleTask, updateTask } from "./actions";

export default async function ChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, project, canEdit } = await getProjectContext(id);
  const tasks = await loadTasks(supabase, project.id);
  const now = today();
  const done = tasks.filter((t) => t.done_at).length;
  const inspections = tasks.filter((t) => t.is_inspection);
  const base = `/dashboard/projects/${project.id}`;

  if (tasks.length === 0) {
    return (
      <Card title="Start your checklist">
        <div className="space-y-3 p-4 text-sm text-stone-700">
          <p>
            The checklist walks every phase from permits to certificate of occupancy, {PHASES.reduce((a, p) => a + p.tasks.length, 0)} tasks in all,
            with each inspection flagged. Tick tasks off as you go and the <TextLink href={`${base}/schedule`}>schedule</TextLink> follows.
          </p>
          {canEdit ? (
            <ActionForm action={seedChecklist} projectId={project.id}>
              <button className={buttonClass}>Create my checklist</button>
            </ActionForm>
          ) : (
            <ViewerNote canEdit={false} />
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ViewerNote canEdit={canEdit} />
      <div className="space-y-1">
        <div className="flex justify-between text-sm text-stone-700">
          <span>
            {done} of {tasks.length} done · {inspections.filter((t) => t.done_at).length} of {inspections.length} inspections passed
          </span>
          <span>{Math.round((done / tasks.length) * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-stone-200">
          <div className="h-full bg-amber-600" style={{ width: `${(done / tasks.length) * 100}%` }} />
        </div>
      </div>

      {PHASES.map((phase) => {
        const mine = tasks.filter((t) => t.phase === phase.key);
        if (!mine.length) return null;
        const phaseDone = mine.every((t) => t.done_at);
        return (
          <Card key={phase.key} title={phase.name} actions={phaseDone ? <Badge tone="green">Done</Badge> : <span className="text-sm text-stone-500">{mine.filter((t) => t.done_at).length}/{mine.length}</span>}>
            <ul className="divide-y divide-stone-100">
              {mine.map((t) => {
                const overdue = !t.done_at && t.due_date && t.due_date < now;
                const soon = !t.done_at && t.due_date && !overdue && daysBetween(now, t.due_date) <= 7;
                return (
                  <li key={t.id} className="flex flex-wrap items-start gap-3 px-4 py-2 text-sm">
                    {canEdit ? (
                      <ActionForm action={toggleTask} projectId={project.id}>
                        <input type="hidden" name="task_id" value={t.id} />
                        <input type="hidden" name="done" value={t.done_at ? "false" : "true"} />
                        <button
                          aria-label={t.done_at ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
                          className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border ${t.done_at ? "border-green-700 bg-green-700 text-white" : "border-stone-400 bg-white"}`}
                        >
                          {t.done_at ? "✓" : ""}
                        </button>
                      </ActionForm>
                    ) : (
                      <span className={`mt-0.5 h-5 w-5 rounded border ${t.done_at ? "border-green-700 bg-green-700" : "border-stone-400"}`} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={t.done_at ? "text-stone-500 line-through" : "text-stone-900"}>{t.title}</span>
                        {t.is_inspection && <Badge tone="blue">Inspection</Badge>}
                        {overdue && <Badge tone="red">Overdue</Badge>}
                        {soon && <Badge tone="amber">Due soon</Badge>}
                      </div>
                      <div className="text-xs text-stone-500">
                        {t.done_at ? `Done ${formatDate(t.done_at)}` : t.due_date ? `Due ${formatDate(t.due_date)}` : null}
                      </div>
                      {canEdit && (
                        <details>
                          <summary className="cursor-pointer text-xs text-stone-500">Edit</summary>
                          <ActionForm action={updateTask} projectId={project.id} resetOnSuccess={false} className="mt-2 grid max-w-lg gap-2 sm:grid-cols-2">
                            <input type="hidden" name="task_id" value={t.id} />
                            <input name="title" defaultValue={t.title} required className={`${inputClass} sm:col-span-2`} aria-label="Task" />
                            <Field label="Due">
                              <input name="due_date" type="date" defaultValue={t.due_date ?? ""} className={inputClass} />
                            </Field>
                            <label className="flex items-center gap-2 self-end pb-2 text-sm">
                              <input type="checkbox" name="is_inspection" defaultChecked={t.is_inspection} /> Inspection
                            </label>
                            <div className="sm:col-span-2">
                              <button className={secondaryButtonClass}>Save</button>
                            </div>
                          </ActionForm>
                          <ActionForm action={deleteTask} projectId={project.id} confirm={`Delete "${t.title}"?`} className="mt-1">
                            <input type="hidden" name="task_id" value={t.id} />
                            <button className={dangerLinkClass}>Delete task</button>
                          </ActionForm>
                        </details>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}

      {canEdit && (
        <Card title="Add a task">
          <ActionForm action={addTask} projectId={project.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_12rem_10rem_auto] sm:items-end">
            <Field label="Task">
              <input name="title" required placeholder="e.g. Septic inspection" className={inputClass} />
            </Field>
            <Field label="Phase">
              <select name="phase" className={inputClass}>
                {PHASES.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due">
              <input name="due_date" type="date" className={inputClass} />
            </Field>
            <button className={buttonClass}>Add</button>
            <label className="flex items-center gap-2 text-sm sm:col-span-4">
              <input type="checkbox" name="is_inspection" /> This is an inspection
            </label>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
