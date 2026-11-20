// Change orders: a sub's price changes, tracked against the line they change.
import { getProjectContext } from "@/lib/project/access";
import { loadBudget } from "@/lib/project/load";
import { formatCents, sumCents } from "@/lib/project/money";
import { formatDate } from "@/lib/project/validate";
import { ACCEPT } from "@/lib/project/documents";
import { ActionForm } from "@/components/project/ActionForm";
import { Badge, Card, Empty, Field, FileLink, TextLink, ViewerNote, buttonClass, dangerLinkClass, inputClass, secondaryButtonClass } from "@/components/project/ui";
import { addChangeOrder, decideChangeOrder, deleteChangeOrder } from "./actions";

type CO = {
  id: string;
  number: number;
  budget_line_id: string;
  title: string;
  description: string | null;
  vendor: string | null;
  amount_cents: number;
  status: "proposed" | "approved" | "rejected";
  decided_on: string | null;
  document_id: string | null;
  created_at: string;
};

export default async function ChangeOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, project, canEdit } = await getProjectContext(id);
  const [{ lines, summary }, { data }] = await Promise.all([
    loadBudget(supabase, project.id),
    supabase.from("change_orders").select("*").eq("project_id", project.id).order("number", { ascending: false }),
  ]);
  const cos = (data ?? []) as CO[];
  const lineById = new Map(summary.lines.map((l) => [l.id, l]));
  const approved = sumCents(cos.filter((c) => c.status === "approved").map((c) => c.amount_cents));
  const pending = sumCents(cos.filter((c) => c.status === "proposed").map((c) => c.amount_cents));

  return (
    <div className="space-y-6">
      <ViewerNote canEdit={canEdit} />
      <p className="text-sm text-stone-700">
        Approved changes add to (or credit) the budget line they belong to, and show up in your <TextLink href={`/dashboard/projects/${project.id}/budget`}>budget</TextLink>{" "}
        alarms. So far: <strong>{formatCents(approved, { whole: true })}</strong> approved, {formatCents(pending, { whole: true })} waiting on you.
      </p>

      {canEdit &&
        (lines.length === 0 ? (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-stone-800">
            Set up your <TextLink href={`/dashboard/projects/${project.id}/budget`}>budget</TextLink> first, so each change has a line to belong to.
          </p>
        ) : (
          <Card title="New change order">
            <ActionForm action={addChangeOrder} projectId={project.id} upload={{ folder: "change_orders", titleField: "title", lineField: "budget_line_id" }} className="grid gap-3 p-4 sm:grid-cols-2">
              <Field label="What changed">
                <input name="title" required placeholder="e.g. Add 2 windows in bonus room" className={inputClass} />
              </Field>
              <Field label="Budget line">
                <select name="budget_line_id" required className={inputClass}>
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Amount ($, negative for a credit)">
                <input name="amount" required inputMode="decimal" placeholder="1500" className={inputClass} />
              </Field>
              <Field label="From (sub or supplier)">
                <input name="vendor" className={inputClass} />
              </Field>
              <Field label="Details" className="sm:col-span-2">
                <textarea name="description" rows={2} className={inputClass} />
              </Field>
              <Field label="Signed change order (optional)">
                <input name="file" type="file" accept={ACCEPT} className="block w-full text-sm" />
              </Field>
              <div className="sm:col-span-2">
                <button className={buttonClass}>Add change order</button>
              </div>
            </ActionForm>
          </Card>
        ))}

      <Card title="Change orders">
        {cos.length === 0 ? (
          <Empty>No change orders yet.</Empty>
        ) : (
          <ul className="divide-y divide-stone-100">
            {cos.map((c) => {
              const line = lineById.get(c.budget_line_id);
              return (
                <li key={c.id} className="space-y-2 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-stone-500">CO #{c.number}</span>
                        <span className="font-medium text-stone-900">{c.title}</span>
                        <Badge tone={c.status === "approved" ? "green" : c.status === "rejected" ? "stone" : "amber"}>
                          {c.status === "proposed" ? "Waiting on you" : c.status === "approved" ? `Approved ${formatDate(c.decided_on)}` : "Rejected"}
                        </Badge>
                      </div>
                      <div className="text-stone-600">
                        {line?.name ?? "Unknown line"}
                        {c.vendor && <> · {c.vendor}</>}
                        {line && line.alarm === "over" && <span className="text-red-700"> · line is over budget</span>}
                      </div>
                      {c.description && <p className="mt-1 text-stone-700">{c.description}</p>}
                      <FileLink projectId={project.id} documentId={c.document_id}>
                        View signed change order
                      </FileLink>
                    </div>
                    <span className={`font-mono text-base ${c.amount_cents < 0 ? "text-green-700" : "text-stone-900"}`}>
                      {c.amount_cents > 0 ? "+" : ""}
                      {formatCents(c.amount_cents)}
                    </span>
                  </div>
                  {canEdit && (
                    <div className="flex flex-wrap items-center gap-2">
                      {c.status !== "approved" && (
                        <ActionForm action={decideChangeOrder} projectId={project.id}>
                          <input type="hidden" name="change_order_id" value={c.id} />
                          <input type="hidden" name="status" value="approved" />
                          <button className={secondaryButtonClass}>Approve</button>
                        </ActionForm>
                      )}
                      {c.status !== "rejected" && (
                        <ActionForm action={decideChangeOrder} projectId={project.id}>
                          <input type="hidden" name="change_order_id" value={c.id} />
                          <input type="hidden" name="status" value="rejected" />
                          <button className={secondaryButtonClass}>Reject</button>
                        </ActionForm>
                      )}
                      <ActionForm action={deleteChangeOrder} projectId={project.id} confirm={`Delete change order #${c.number}?`}>
                        <input type="hidden" name="change_order_id" value={c.id} />
                        <button className={dangerLinkClass}>Delete</button>
                      </ActionForm>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
