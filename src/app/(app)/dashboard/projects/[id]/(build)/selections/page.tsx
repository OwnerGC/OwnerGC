// Selections and allowances: the tile, faucets, cabinets and appliances you
// pick, with the allowance you planned vs. what you actually chose.
import { getProjectContext } from "@/lib/project/access";
import { loadBudget } from "@/lib/project/load";
import { centsToInput, formatCents, sumCents } from "@/lib/project/money";
import { ACCEPT } from "@/lib/project/documents";
import { formatDate, today } from "@/lib/project/validate";
import { ActionForm } from "@/components/project/ActionForm";
import { Badge, Card, Empty, Field, FileLink, Stat, ViewerNote, buttonClass, dangerLinkClass, inputClass, secondaryButtonClass } from "@/components/project/ui";
import { addSelection, deleteSelection, updateSelection } from "./actions";

type Sel = {
  id: string;
  budget_line_id: string | null;
  category: string;
  item: string;
  allowance_cents: number;
  actual_cents: number | null;
  status: "choosing" | "selected" | "ordered" | "installed";
  vendor: string | null;
  due_on: string | null;
  notes: string | null;
  document_id: string | null;
};

const CATEGORIES = ["Kitchen", "Bathrooms", "Flooring", "Lighting", "Plumbing fixtures", "Appliances", "Cabinets & counters", "Doors & hardware", "Exterior", "Other"];
const STATUS_LABEL = { choosing: "Still choosing", selected: "Chosen", ordered: "Ordered", installed: "Installed" } as const;

export default async function SelectionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, project, canEdit } = await getProjectContext(id);
  const [{ lines }, { data }] = await Promise.all([
    loadBudget(supabase, project.id),
    supabase.from("selections").select("*").eq("project_id", project.id).order("category").order("item"),
  ]);
  const sels = (data ?? []) as Sel[];
  const priced = sels.filter((s) => s.actual_cents !== null);
  const allowance = sumCents(sels.map((s) => s.allowance_cents));
  const overUnder = sumCents(priced.map((s) => s.actual_cents! - s.allowance_cents));
  const lineName = new Map(lines.map((l) => [l.id, l.name]));
  const byCat = new Map<string, Sel[]>();
  for (const s of sels) byCat.set(s.category || "Other", [...(byCat.get(s.category || "Other") ?? []), s]);
  const now = today();

  return (
    <div className="space-y-6">
      <ViewerNote canEdit={canEdit} />
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Allowances" value={formatCents(allowance, { whole: true })} note={`${sels.length} items`} />
        <Stat label="Chosen so far" value={`${priced.length} of ${sels.length}`} />
        <Stat
          label={overUnder > 0 ? "Over allowance" : "Under allowance"}
          value={formatCents(Math.abs(overUnder), { whole: true })}
          tone={overUnder > 0 ? "bad" : overUnder < 0 ? "good" : undefined}
          note="on items with a real price"
        />
      </section>

      {sels.length === 0 && (
        <Card>
          <Empty>No selections yet. Add the finishes you still need to pick, with the allowance from your budget or contract.</Empty>
        </Card>
      )}

      {[...byCat.entries()].map(([cat, list]) => (
        <Card key={cat} title={cat}>
          <ul className="divide-y divide-stone-100">
            {list.map((s) => {
              const diff = s.actual_cents === null ? null : s.actual_cents - s.allowance_cents;
              const late = s.status === "choosing" && s.due_on && s.due_on < now;
              return (
                <li key={s.id} className="space-y-1 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-stone-900">{s.item}</span>
                        <Badge tone={s.status === "choosing" ? "amber" : s.status === "installed" ? "green" : "blue"}>{STATUS_LABEL[s.status]}</Badge>
                        {late && <Badge tone="red">Decision overdue</Badge>}
                      </div>
                      <div className="text-stone-600">
                        {[s.vendor, s.budget_line_id && lineName.get(s.budget_line_id), s.due_on && s.status === "choosing" ? `decide by ${formatDate(s.due_on)}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                      {s.notes && <p className="text-stone-700">{s.notes}</p>}
                      <FileLink projectId={project.id} documentId={s.document_id}>
                        View spec or quote
                      </FileLink>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-stone-500">allow {formatCents(s.allowance_cents, { whole: true })}</div>
                      {s.actual_cents !== null && <div className="text-base text-stone-900">{formatCents(s.actual_cents, { whole: true })}</div>}
                      {diff !== null && diff !== 0 && (
                        <div className={`text-xs ${diff > 0 ? "text-red-700" : "text-green-700"}`}>
                          {diff > 0 ? "+" : "−"}
                          {formatCents(Math.abs(diff), { whole: true })}
                        </div>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <details>
                      <summary className="cursor-pointer text-xs text-stone-500">Edit</summary>
                      <ActionForm action={updateSelection} projectId={project.id} resetOnSuccess={false} upload={{ folder: "other", titleField: "item" }} className="mt-2 grid gap-2 sm:grid-cols-3">
                        <input type="hidden" name="selection_id" value={s.id} />
                        <SelectionFields s={s} lines={lines} />
                        <div className="sm:col-span-3">
                          <button className={secondaryButtonClass}>Save</button>
                        </div>
                      </ActionForm>
                      <ActionForm action={deleteSelection} projectId={project.id} confirm={`Delete "${s.item}"?`} className="mt-1">
                        <input type="hidden" name="selection_id" value={s.id} />
                        <button className={dangerLinkClass}>Delete</button>
                      </ActionForm>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      ))}

      {canEdit && (
        <Card title="Add a selection">
          <ActionForm action={addSelection} projectId={project.id} upload={{ folder: "other", titleField: "item" }} className="grid gap-3 p-4 sm:grid-cols-3">
            <SelectionFields lines={lines} />
            <div className="sm:col-span-3">
              <button className={buttonClass}>Add selection</button>
            </div>
          </ActionForm>
        </Card>
      )}
      <datalist id="sel-categories">
        {CATEGORIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </div>
  );
}

function SelectionFields({ s, lines }: { s?: Sel; lines: { id: string; name: string }[] }) {
  return (
    <>
      <Field label="Item">
        <input name="item" required defaultValue={s?.item} placeholder="e.g. Kitchen faucet" className={inputClass} />
      </Field>
      <Field label="Category">
        <input name="category" list="sel-categories" defaultValue={s?.category} className={inputClass} />
      </Field>
      <Field label="Status">
        <select name="status" defaultValue={s?.status ?? "choosing"} className={inputClass}>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Allowance ($)">
        <input name="allowance" inputMode="decimal" defaultValue={s ? centsToInput(s.allowance_cents) : ""} placeholder="400" className={inputClass} />
      </Field>
      <Field label="Actual price ($)">
        <input name="actual" inputMode="decimal" defaultValue={s?.actual_cents != null ? centsToInput(s.actual_cents) : ""} placeholder="When chosen" className={inputClass} />
      </Field>
      <Field label="Decide by">
        <input name="due_on" type="date" defaultValue={s?.due_on ?? ""} className={inputClass} />
      </Field>
      <Field label="Store or supplier">
        <input name="vendor" defaultValue={s?.vendor ?? ""} className={inputClass} />
      </Field>
      <Field label="Budget line">
        <select name="budget_line_id" defaultValue={s?.budget_line_id ?? ""} className={inputClass}>
          <option value="">None</option>
          {lines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Spec sheet or quote">
        <input name="file" type="file" accept={ACCEPT} className="block w-full text-sm" />
      </Field>
      <Field label="Notes" className="sm:col-span-3">
        <input name="notes" defaultValue={s?.notes ?? ""} className={inputClass} />
      </Field>
    </>
  );
}
