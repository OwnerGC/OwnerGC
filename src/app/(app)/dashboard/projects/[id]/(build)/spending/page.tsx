// Every payment, with its receipt, budget line and lien waiver status.
import Link from "next/link";
import { getProjectContext } from "@/lib/project/access";
import { loadBudget } from "@/lib/project/load";
import { waiverState } from "@/lib/project/budget";
import { formatCents, sumCents } from "@/lib/project/money";
import { formatDate, isUuid, today } from "@/lib/project/validate";
import { ACCEPT } from "@/lib/project/documents";
import { ActionForm } from "@/components/project/ActionForm";
import { Badge, Card, Empty, Field, FileLink, ViewerNote, buttonClass, dangerLinkClass, inputClass, secondaryButtonClass } from "@/components/project/ui";
import { addExpense, attachReceipt, deleteExpense, updateExpenseLine } from "./actions";

const WAIVER_BADGE = {
  not_needed: null,
  missing: <Badge tone="red">No waiver</Badge>,
  requested: <Badge tone="amber">Waiver requested</Badge>,
  received: <Badge tone="green">Waiver in</Badge>,
} as const;

export default async function SpendingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ line?: string }> }) {
  const { id } = await params;
  const { line: lineFilter } = await searchParams;
  const { supabase, project, canEdit } = await getProjectContext(id);
  const { lines, expenses, waivers } = await loadBudget(supabase, project.id);
  const lineName = new Map(lines.map((l) => [l.id, l.name]));
  const filterId = isUuid(lineFilter) && lineName.has(lineFilter) ? lineFilter : null;
  const shown = filterId ? expenses.filter((e) => e.budget_line_id === filterId) : expenses;
  const base = `/dashboard/projects/${project.id}`;

  return (
    <div className="space-y-6">
      <ViewerNote canEdit={canEdit} />

      {canEdit && (
        <Card title="Log a payment">
          <ActionForm
            action={addExpense}
            projectId={project.id}
            upload={{ folder: "receipts", titleField: "vendor", lineField: "budget_line_id" }}
            className="grid gap-3 p-4 sm:grid-cols-2"
          >
            <Field label="Paid to">
              <input name="vendor" required placeholder="e.g. Ready Mix Concrete" className={inputClass} />
            </Field>
            <Field label="Amount ($)">
              <input name="amount" required inputMode="decimal" placeholder="1250.00" className={inputClass} />
            </Field>
            <Field label="Date">
              <input name="spent_on" type="date" defaultValue={today()} className={inputClass} />
            </Field>
            <Field label="Budget line">
              <select name="budget_line_id" defaultValue={filterId ?? ""} className={inputClass}>
                <option value="">Not assigned</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.division ? `${l.division} · ` : ""}
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Receipt or invoice (photo or PDF)">
              <input name="file" type="file" accept={ACCEPT} className="block w-full text-sm" />
            </Field>
            <Field label="Note">
              <input name="note" placeholder="Optional" className={inputClass} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-2">
              <input type="checkbox" name="waiver_required" defaultChecked />
              Needs a lien waiver (uncheck for things like permit fees or store purchases)
            </label>
            <div className="sm:col-span-2">
              <button className={buttonClass}>Save payment</button>
            </div>
          </ActionForm>
        </Card>
      )}

      <Card
        title={filterId ? `Spending on ${lineName.get(filterId)}` : "All spending"}
        actions={
          <div className="flex items-center gap-3 text-sm">
            {filterId && (
              <Link href={`${base}/spending`} className="text-stone-600 underline">
                Show all
              </Link>
            )}
            <a href={`${base}/spending/export`} className="text-amber-700 underline">
              Download CSV
            </a>
          </div>
        }
      >
        {shown.length === 0 ? (
          <Empty>No payments logged yet.</Empty>
        ) : (
          <ul className="divide-y divide-stone-100">
            {shown.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-stone-900">{e.vendor}</span>
                    {WAIVER_BADGE[waiverState(e, waivers)]}
                    {!e.document_id && <Badge tone="stone">No receipt</Badge>}
                  </div>
                  <div className="text-stone-600">
                    {formatDate(e.spent_on)} · {e.budget_line_id ? lineName.get(e.budget_line_id) : "Not assigned to a line"}
                    {e.note && <> · {e.note}</>}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <FileLink projectId={project.id} documentId={e.document_id}>
                      View receipt
                    </FileLink>
                    {canEdit && (
                      <details>
                        <summary className="cursor-pointer text-stone-500">Change</summary>
                        <div className="mt-2 space-y-2">
                          <ActionForm action={updateExpenseLine} projectId={project.id} resetOnSuccess={false} className="flex flex-wrap gap-2">
                            <input type="hidden" name="expense_id" value={e.id} />
                            <select name="budget_line_id" defaultValue={e.budget_line_id ?? ""} className={inputClass} aria-label="Budget line">
                              <option value="">Not assigned</option>
                              {lines.map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.name}
                                </option>
                              ))}
                            </select>
                            <button className={secondaryButtonClass}>Move</button>
                          </ActionForm>
                          {!e.document_id && (
                            <ActionForm action={attachReceipt} projectId={project.id} upload={{ folder: "receipts" }} className="flex flex-wrap items-center gap-2">
                              <input type="hidden" name="expense_id" value={e.id} />
                              <input name="file" type="file" accept={ACCEPT} required className="text-sm" />
                              <button className={secondaryButtonClass}>Attach receipt</button>
                            </ActionForm>
                          )}
                          <ActionForm action={deleteExpense} projectId={project.id} confirm="Delete this payment? Its receipt stays in Documents.">
                            <input type="hidden" name="expense_id" value={e.id} />
                            <button className={dangerLinkClass}>Delete payment</button>
                          </ActionForm>
                        </div>
                      </details>
                    )}
                  </div>
                </div>
                <span className="font-mono text-base text-stone-900">{formatCents(e.amount_cents)}</span>
              </li>
            ))}
            <li className="flex justify-between px-4 py-3 text-sm font-semibold">
              <span>Total</span>
              <span className="font-mono">{formatCents(sumCents(shown.map((e) => e.amount_cents)))}</span>
            </li>
          </ul>
        )}
      </Card>
    </div>
  );
}
