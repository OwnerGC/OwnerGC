// Lien waiver tracker: every payment to a sub or supplier needs a signed
// waiver, or they could put a lien on your house. Payments without one are
// flagged here and kept out of loan draw packages.
import { getProjectContext } from "@/lib/project/access";
import { loadBudget } from "@/lib/project/load";
import { WAIVER_TYPES, waiverState, waiversByVendor } from "@/lib/project/budget";
import { formatCents, sumCents } from "@/lib/project/money";
import { formatDate, today } from "@/lib/project/validate";
import { ACCEPT } from "@/lib/project/documents";
import { ActionForm } from "@/components/project/ActionForm";
import { Badge, Card, Empty, Field, FileLink, Stat, ViewerNote, inputClass, secondaryButtonClass } from "@/components/project/ui";
import { saveWaiver, setWaiverRequired } from "./actions";

export default async function WaiversPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, project, canEdit } = await getProjectContext(id);
  const { expenses, waivers } = await loadBudget(supabase, project.id);
  const vendors = waiversByVendor(expenses, waivers);
  const open = expenses.filter((e) => ["missing", "requested"].includes(waiverState(e, waivers)));
  const done = expenses.filter((e) => waiverState(e, waivers) === "received");
  const notNeeded = expenses.filter((e) => waiverState(e, waivers) === "not_needed");
  const waiverFor = new Map(waivers.map((w) => [w.expense_id, w]));
  const uncovered = sumCents(open.map((e) => e.amount_cents));

  return (
    <div className="space-y-6">
      <ViewerNote canEdit={canEdit} />
      <p className="text-sm text-stone-700">
        A lien waiver is the sub&apos;s signed note that they&apos;ve been paid. Without one, an unpaid sub or supplier can put a lien on your
        house, and most lenders won&apos;t fund a draw without them. Payments still missing a waiver are left out of draw packages.
      </p>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Paid without a waiver" value={formatCents(uncovered, { whole: true })} tone={uncovered ? "bad" : "good"} note={`${open.length} payment${open.length === 1 ? "" : "s"}`} />
        <Stat label="Covered by waivers" value={formatCents(sumCents(done.map((e) => e.amount_cents)), { whole: true })} note={`${done.length} payments`} />
        <Stat label="No waiver needed" value={formatCents(sumCents(notNeeded.map((e) => e.amount_cents)), { whole: true })} note={`${notNeeded.length} payments`} />
      </section>

      <Card title="By sub or supplier">
        {vendors.length === 0 ? (
          <Empty>No payments that need waivers yet.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2">Paid to</th>
                <th className="px-4 py-2 text-right">Paid</th>
                <th className="px-4 py-2 text-right">Covered</th>
                <th className="px-4 py-2 text-right">Missing</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.vendor} className="border-t border-stone-100">
                  <td className="px-4 py-2 text-stone-900">{v.vendor}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatCents(v.paidCents, { whole: true })}</td>
                  <td className="px-4 py-2 text-right font-mono text-green-700">{formatCents(v.coveredCents, { whole: true })}</td>
                  <td className={`px-4 py-2 text-right font-mono ${v.uncoveredCents ? "text-red-700" : "text-stone-400"}`}>
                    {v.uncoveredCents ? formatCents(v.uncoveredCents, { whole: true }) : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Payments waiting on a waiver">
        {open.length === 0 ? (
          <Empty>Every payment that needs a waiver has one. Nice.</Empty>
        ) : (
          <ul className="divide-y divide-stone-100">
            {open.map((e) => {
              const w = waiverFor.get(e.id);
              return (
                <li key={e.id} className="space-y-2 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="font-medium text-stone-900">{e.vendor}</span>{" "}
                      <span className="text-stone-600">
                        · {formatDate(e.spent_on)} · {formatCents(e.amount_cents)}
                      </span>{" "}
                      {w ? <Badge tone="amber">Requested</Badge> : <Badge tone="red">Missing</Badge>}
                    </span>
                  </div>
                  {canEdit && (
                    <div className="flex flex-wrap items-end gap-2">
                      <ActionForm action={saveWaiver} projectId={project.id} upload={{ folder: "lien_waivers" }} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="expense_id" value={e.id} />
                        <input type="hidden" name="status" value="received" />
                        <Field label="Type">
                          <select name="waiver_type" defaultValue={w?.waiver_type ?? "conditional_progress"} className={inputClass}>
                            {Object.entries(WAIVER_TYPES).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Signed waiver">
                          <input name="file" type="file" accept={ACCEPT} className="block text-sm" />
                        </Field>
                        <input type="hidden" name="received_on" value={today()} />
                        <button className={secondaryButtonClass}>Mark received</button>
                      </ActionForm>
                      {!w && (
                        <ActionForm action={saveWaiver} projectId={project.id}>
                          <input type="hidden" name="expense_id" value={e.id} />
                          <input type="hidden" name="status" value="requested" />
                          <button className={secondaryButtonClass}>Mark requested</button>
                        </ActionForm>
                      )}
                      <ActionForm action={setWaiverRequired} projectId={project.id}>
                        <input type="hidden" name="expense_id" value={e.id} />
                        <input type="hidden" name="required" value="false" />
                        <button className="text-sm text-stone-600 underline">Doesn&apos;t need one</button>
                      </ActionForm>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {done.length > 0 && (
        <Card title="Waivers received">
          <ul className="divide-y divide-stone-100">
            {done.map((e) => {
              const w = waiverFor.get(e.id)!;
              return (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                  <span>
                    <span className="text-stone-900">{e.vendor}</span>{" "}
                    <span className="text-stone-600">
                      · {formatCents(e.amount_cents)} · {WAIVER_TYPES[w.waiver_type as keyof typeof WAIVER_TYPES]}
                    </span>
                  </span>
                  <FileLink projectId={project.id} documentId={w.document_id}>
                    View waiver
                  </FileLink>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {canEdit && notNeeded.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-stone-600">Payments marked as not needing a waiver ({notNeeded.length})</summary>
          <ul className="mt-2 space-y-1">
            {notNeeded.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2">
                <span className="text-stone-800">
                  {e.vendor} · {formatCents(e.amount_cents)}
                </span>
                <ActionForm action={setWaiverRequired} projectId={project.id}>
                  <input type="hidden" name="expense_id" value={e.id} />
                  <input type="hidden" name="required" value="true" />
                  <button className="text-amber-700 underline">Needs one after all</button>
                </ActionForm>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
