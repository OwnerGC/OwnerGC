// Budget vs. committed vs. spent, line by line, with alarms and contingency.
import Link from "next/link";
import { getProjectContext } from "@/lib/project/access";
import { loadBudget } from "@/lib/project/load";
import { centsToInput, formatCents } from "@/lib/project/money";
import { hasSavedEstimate } from "@/lib/estimator";
import { ActionForm } from "@/components/project/ActionForm";
import { Badge, Card, Empty, Field, Stat, ViewerNote, buttonClass, dangerLinkClass, inputClass, secondaryButtonClass } from "@/components/project/ui";
import { addBudgetLine, deleteBudgetLine, seedBudgetFromEstimate, updateBudgetLine } from "./actions";

export default async function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, project, canEdit } = await getProjectContext(id);
  const { summary, lines } = await loadBudget(supabase, project.id);
  const { totals, contingency } = summary;
  const money = (c: number) => formatCents(c, { whole: true });
  const base = `/dashboard/projects/${project.id}`;

  return (
    <div className="space-y-6">
      <ViewerNote canEdit={canEdit} />

      {lines.length === 0 ? (
        <Card title="Set up your budget">
          <div className="space-y-3 p-4 text-sm text-stone-700">
            {hasSavedEstimate(project.inputs) ? (
              <>
                <p>Start from your estimate: every line item becomes a budget line you can edit. You can add your own lines too.</p>
                {canEdit && (
                  <ActionForm action={seedBudgetFromEstimate} projectId={project.id}>
                    <button className={buttonClass}>Create budget from my estimate</button>
                  </ActionForm>
                )}
              </>
            ) : (
              <p>
                This project has no estimate yet. <Link href={`/estimate?project=${project.id}`} className="text-amber-700 underline">Run the estimator</Link>{" "}
                to start from a full line-item budget, or add lines yourself below.
              </p>
            )}
          </div>
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Budget" value={money(totals.budgetCents)} />
            <Stat label="Committed" value={money(totals.committedCents)} note="awarded bids + approved changes" />
            <Stat label="Spent" value={money(totals.spentCents)} />
            <Stat
              label="Projected"
              value={money(totals.projectedCents)}
              tone={totals.projectedCents > totals.budgetCents ? "bad" : undefined}
              note={`${totals.projectedCents > totals.budgetCents ? "over" : "under"} by ${money(Math.abs(totals.budgetCents - totals.projectedCents))}`}
            />
            <Stat
              label="Contingency left"
              value={money(contingency.leftCents)}
              tone={contingency.leftCents < 0 ? "bad" : contingency.leftCents < contingency.budgetCents / 3 ? "warn" : "good"}
              note={contingency.budgetCents ? `of ${money(contingency.budgetCents)}` : "no contingency line"}
            />
          </section>

          {summary.alarms.length > 0 && (
            <Card title="Budget alarms">
              <ul className="divide-y divide-stone-100 text-sm">
                {summary.alarms.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                    <span>
                      <Badge tone={l.alarm === "over" ? "red" : "amber"}>{l.alarm === "over" ? "Over" : "Watch"}</Badge>{" "}
                      <span className="font-medium text-stone-900">{l.name}</span> <span className="text-stone-600">· {l.alarmReason}</span>
                    </span>
                    <span className="font-mono text-stone-700">
                      {l.varianceCents < 0 ? `${money(-l.varianceCents)} over` : `${money(l.remainingCents)} left`}
                    </span>
                  </li>
                ))}
              </ul>
              {contingency.overrunsCents > 0 && (
                <p className="border-t border-stone-100 px-4 py-2 text-sm text-stone-600">
                  Overruns of {money(contingency.overrunsCents)} come out of your contingency.
                </p>
              )}
            </Card>
          )}

          <Card title="Line items">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-3 py-2">Div</th>
                    <th className="px-3 py-2">Line</th>
                    <th className="px-3 py-2 text-right">Budget</th>
                    <th className="px-3 py-2 text-right">Changes</th>
                    <th className="px-3 py-2 text-right">Committed</th>
                    <th className="px-3 py-2 text-right">Spent</th>
                    <th className="px-3 py-2 text-right">Projected</th>
                    <th className="px-3 py-2 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.lines.map((l) => (
                    <tr key={l.id} className="border-t border-stone-100 align-top">
                      <td className="px-3 py-2 font-mono text-stone-500">{l.division}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-stone-900">{l.name}</span>
                          {l.is_diy && <Badge tone="green">DIY</Badge>}
                          {l.alarm === "over" && <Badge tone="red">Over</Badge>}
                          {l.alarm === "watch" && <Badge tone="amber">Watch</Badge>}
                        </div>
                        {canEdit && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs text-stone-500">Edit</summary>
                            <ActionForm action={updateBudgetLine} projectId={project.id} resetOnSuccess={false} className="mt-2 grid max-w-md grid-cols-[4rem_1fr_8rem] gap-2">
                              <input type="hidden" name="line_id" value={l.id} />
                              <input name="division" defaultValue={l.division} className={inputClass} aria-label="Division" />
                              <input name="name" defaultValue={l.name} required className={inputClass} aria-label="Name" />
                              <input name="amount" defaultValue={centsToInput(l.budget_cents)} inputMode="decimal" className={inputClass} aria-label="Budget" />
                              <div className="col-span-3 flex items-center gap-3">
                                <button className={secondaryButtonClass}>Save</button>
                              </div>
                            </ActionForm>
                            <ActionForm action={deleteBudgetLine} projectId={project.id} confirm={`Delete the line "${l.name}"?`} className="mt-1">
                              <input type="hidden" name="line_id" value={l.id} />
                              <button className={dangerLinkClass}>Delete line</button>
                            </ActionForm>
                          </details>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{money(l.budget_cents)}</td>
                      <td className="px-3 py-2 text-right font-mono text-stone-600">
                        {l.changesCents ? money(l.changesCents) : "–"}
                        {l.pendingChangesCents !== 0 && <div className="text-xs text-amber-700">{money(l.pendingChangesCents)} pending</div>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-stone-600">{l.committedCents ? money(l.committedCents) : "–"}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {l.spentCents ? (
                          <Link href={`${base}/spending?line=${l.id}`} className="underline decoration-stone-300">
                            {money(l.spentCents)}
                          </Link>
                        ) : (
                          "–"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{money(l.projectedCents)}</td>
                      <td className={`px-3 py-2 text-right font-mono ${l.varianceCents < 0 ? "text-red-700" : l.varianceCents > 0 ? "text-green-700" : "text-stone-400"}`}>
                        {l.varianceCents === 0 ? "–" : l.varianceCents < 0 ? money(l.varianceCents) : `+${money(l.varianceCents)}`}
                      </td>
                    </tr>
                  ))}
                  {totals.unassignedSpentCents > 0 && (
                    <tr className="border-t border-stone-100">
                      <td></td>
                      <td className="px-3 py-2 text-stone-600">Spending not assigned to a line</td>
                      <td colSpan={3}></td>
                      <td className="px-3 py-2 text-right font-mono">{money(totals.unassignedSpentCents)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-stone-800 font-semibold">
                    <td></td>
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right font-mono">{money(totals.budgetCents)}</td>
                    <td className="px-3 py-2 text-right font-mono">{money(totals.changesCents)}</td>
                    <td className="px-3 py-2 text-right font-mono">{money(totals.committedCents)}</td>
                    <td className="px-3 py-2 text-right font-mono">{money(totals.spentCents)}</td>
                    <td className="px-3 py-2 text-right font-mono">{money(totals.projectedCents)}</td>
                    <td className={`px-3 py-2 text-right font-mono ${totals.budgetCents - totals.projectedCents < 0 ? "text-red-700" : "text-green-700"}`}>
                      {money(totals.budgetCents - totals.projectedCents)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {summary.lines.length === 0 && <Empty>No budget lines yet.</Empty>}
          </Card>
          <p className="text-xs text-stone-500">
            Projected is the awarded bid plus approved changes, or the budget plus approved changes when there&apos;s no bid yet, or what
            you&apos;ve spent if that&apos;s more. A line turns amber at 90% spent and red when it&apos;s projected over budget.
          </p>
        </>
      )}

      {canEdit && (
        <Card title="Add a budget line">
          <ActionForm action={addBudgetLine} projectId={project.id} className="grid gap-3 p-4 sm:grid-cols-[5rem_1fr_10rem_auto] sm:items-end">
            <Field label="Division">
              <input name="division" placeholder="09" className={inputClass} />
            </Field>
            <Field label="Name">
              <input name="name" required placeholder="e.g. Fencing" className={inputClass} />
            </Field>
            <Field label="Budget ($)">
              <input name="amount" inputMode="decimal" placeholder="0" className={inputClass} />
            </Field>
            <button className={buttonClass}>Add line</button>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
