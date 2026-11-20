// One saved project and its estimate. The numbers are recalculated from the
// saved inputs with the same cost model as the estimator, so they always match.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { estimate, hasSavedEstimate, inputsToSearchParams, money, parseEstimateInputs, percent, shortMoney } from "@/lib/estimator";

type Props = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Row-level security returns nothing unless this user is a member of the project.
  const { data: project } = await supabase.from("projects").select("id, name, address, inputs").eq("id", id).maybeSingle();
  if (!project) notFound();

  const saved = hasSavedEstimate(project.inputs);
  const inputs = parseEstimateInputs(project.inputs);
  const e = estimate(inputs);
  const editParams = inputsToSearchParams(inputs);
  editParams.set("project", project.id);

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <Link href="/dashboard" className="text-sm text-stone-600 underline">
        ← Your projects
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{project.name}</h1>
          {project.address && <p className="text-stone-600">{project.address}</p>}
        </div>
        <Link
          href={`/estimate?${editParams}`}
          className="rounded-md bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700"
        >
          {saved ? "Edit estimate" : "Add an estimate"}
        </Link>
      </header>

      {!saved ? (
        <p className="rounded-md border border-stone-200 bg-white p-4 text-stone-700">
          This project doesn&apos;t have an estimate yet. Open the estimator to price it out and save it here.
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="All-in cost" value={shortMoney(e.allIn)} note="land + build" />
            <Stat label="Build cost" value={shortMoney(e.buildCost)} note={e.costPerFinishedSqft ? `${money(e.costPerFinishedSqft)}/finished sf` : "–"} />
            <Stat label="You save" value={shortMoney(e.savings.total)} note="vs. hiring a builder" />
            <Stat label="Timeline" value={`${e.schedule.totalWeeks} wks`} note={`about ${e.schedule.months} months`} />
          </section>

          <section className="rounded-md border border-stone-200 bg-white">
            <h2 className="border-b border-stone-200 px-4 py-3 font-medium text-stone-900">Line-item budget</h2>
            <table className="w-full text-sm">
              <tbody>
                {e.groups.map((g) => [
                  <tr key={g.group} className="bg-stone-50">
                    <td colSpan={2} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-600">
                      {g.group}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-stone-500">{percent(g.share)}</td>
                  </tr>,
                  ...[...e.lines, ...e.softCosts]
                    .filter((l) => l.group === g.group)
                    .map((l) => (
                      <tr key={l.key} className="border-t border-stone-100">
                        <td className="w-12 px-4 py-2 font-mono text-stone-500">{l.division}</td>
                        <td className="py-2 text-stone-800">
                          {l.name}
                          {l.tag && (
                            <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                              {l.tag === "diy" ? "DIY" : "Self-supply"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-stone-900">{money(l.cost)}</td>
                      </tr>
                    )),
                ])}
                <tr className="border-t-2 border-stone-800 font-semibold">
                  <td></td>
                  <td className="py-3">Total build cost</td>
                  <td className="px-4 py-3 text-right font-mono">{money(e.buildCost)}</td>
                </tr>
                <tr>
                  <td></td>
                  <td className="pb-3 text-stone-600">Land</td>
                  <td className="px-4 pb-3 text-right font-mono text-stone-600">{money(e.land)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="rounded-md border border-stone-200 bg-white p-4">
            <h2 className="mb-3 font-medium text-stone-900">Build schedule</h2>
            <ol className="space-y-1 text-sm">
              {e.schedule.phases.map((p) => (
                <li key={p.key} className="flex justify-between gap-4">
                  <span className="text-stone-800">
                    {p.name}
                    {p.diy && <span className="ml-2 text-xs text-green-700">you</span>}
                  </span>
                  <span className="font-mono text-stone-500">
                    weeks {p.startWeek + 1}–{p.startWeek + p.weeks}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <p className="text-xs text-stone-500">Planning-grade estimate, not a bid, appraisal or financial advice. Get real bids before you lock a loan amount.</p>
        </>
      )}
    </main>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-md border border-stone-200 bg-white p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-1 font-mono text-xl text-stone-900">{value}</div>
      <div className="text-xs text-stone-500">{note}</div>
    </div>
  );
}
