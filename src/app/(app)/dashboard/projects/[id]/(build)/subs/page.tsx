// "Know who to call": every sub and supplier by trade, one tap to call or
// email, with license and insurance expiry tracked.
import { getProjectContext } from "@/lib/project/access";
import { loadSubsAndBids } from "@/lib/project/load";
import { subCompliance, type SubRow } from "@/lib/project/bids";
import { LINES } from "@/lib/estimator";
import { ACCEPT } from "@/lib/project/documents";
import { formatDate, today } from "@/lib/project/validate";
import { ActionForm } from "@/components/project/ActionForm";
import { Badge, Card, Empty, Field, FileLink, ViewerNote, buttonClass, dangerLinkClass, inputClass, secondaryButtonClass } from "@/components/project/ui";
import { addSub, deleteSub, updateSub } from "./actions";

const TRADES = [...new Set(LINES.map((l) => l.trade))];

export default async function SubsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, project, canEdit } = await getProjectContext(id);
  const [{ subs, bids }, { data: certs }] = await Promise.all([
    loadSubsAndBids(supabase, project.id),
    supabase.from("documents").select("id, sub_id, title, expires_on").eq("project_id", project.id).not("sub_id", "is", null).order("created_at", { ascending: false }),
  ]);
  const now = today();
  const awardedSubs = new Set(bids.filter((b) => b.status === "awarded").map((b) => b.sub_id));
  const byTrade = new Map<string, SubRow[]>();
  for (const s of subs) byTrade.set(s.trade || "Other", [...(byTrade.get(s.trade || "Other") ?? []), s]);
  const problems = subs.map((s) => ({ s, c: subCompliance(s, now, awardedSubs.has(s.id)) })).filter((x) => x.c.problems.length);

  return (
    <div className="space-y-6">
      <ViewerNote canEdit={canEdit} />

      {problems.length > 0 && (
        <Card title="Insurance and licenses to chase">
          <ul className="divide-y divide-stone-100 text-sm">
            {problems.map(({ s, c }) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span className="font-medium text-stone-900">{s.company}</span>
                <span className="flex flex-wrap gap-1">
                  {c.problems.map((p) => (
                    <Badge key={p} tone={p.includes("expired") || p.startsWith("No") ? "red" : "amber"}>
                      {p}
                    </Badge>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-stone-100 px-4 py-2 text-xs text-stone-600">
            Don&apos;t let a sub on site without current liability and workers&apos; comp insurance. If they get hurt uninsured, it can land on you.
          </p>
        </Card>
      )}

      {subs.length === 0 && <Card><Empty>No subs yet. Add the people you&apos;re getting bids from below.</Empty></Card>}

      {[...byTrade.entries()].map(([trade, list]) => (
        <Card key={trade} title={trade}>
          <ul className="divide-y divide-stone-100">
            {list.map((s) => {
              const c = subCompliance(s, now, awardedSubs.has(s.id));
              const files = (certs ?? []).filter((d) => d.sub_id === s.id);
              return (
                <li key={s.id} className="space-y-1 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-stone-900">{s.company}</span>
                    {s.contact_name && <span className="text-stone-600">{s.contact_name}</span>}
                    {awardedSubs.has(s.id) && <Badge tone="green">Hired</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {s.phone && (
                      <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`} className="text-amber-700 underline">
                        {s.phone}
                      </a>
                    )}
                    {s.email && (
                      <a href={`mailto:${s.email}`} className="text-amber-700 underline">
                        {s.email}
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-stone-600">
                    <span>
                      Insurance:{" "}
                      <ExpiryBadge state={c.insurance} date={s.insurance_expires_on} />
                    </span>
                    <span>
                      License{s.license_number ? ` ${s.license_number}` : ""}: <ExpiryBadge state={c.license} date={s.license_expires_on} />
                    </span>
                  </div>
                  {files.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {files.map((f) => (
                        <FileLink key={f.id} projectId={project.id} documentId={f.id}>
                          {f.title}
                        </FileLink>
                      ))}
                    </div>
                  )}
                  {s.notes && <p className="text-stone-700">{s.notes}</p>}
                  {canEdit && (
                    <details>
                      <summary className="cursor-pointer text-xs text-stone-500">Edit</summary>
                      <ActionForm action={updateSub} projectId={project.id} resetOnSuccess={false} upload={{ folder: "insurance", subField: "sub_id", expiresField: "insurance_expires_on" }} className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input type="hidden" name="sub_id" value={s.id} />
                        <SubFields sub={s} />
                        <Field label="Upload insurance certificate or license (optional)" className="sm:col-span-2">
                          <input name="file" type="file" accept={ACCEPT} className="block text-sm" />
                        </Field>
                        <div className="sm:col-span-2">
                          <button className={secondaryButtonClass}>Save</button>
                        </div>
                      </ActionForm>
                      <ActionForm action={deleteSub} projectId={project.id} confirm={`Remove ${s.company}?`} className="mt-1">
                        <input type="hidden" name="sub_id" value={s.id} />
                        <button className={dangerLinkClass}>Remove</button>
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
        <Card title="Add a sub or supplier">
          <ActionForm action={addSub} projectId={project.id} className="grid gap-3 p-4 sm:grid-cols-2">
            <SubFields />
            <div className="sm:col-span-2">
              <button className={buttonClass}>Add</button>
            </div>
          </ActionForm>
        </Card>
      )}
      <datalist id="trades">
        {TRADES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  );
}

function SubFields({ sub }: { sub?: SubRow }) {
  return (
    <>
      <Field label="Company">
        <input name="company" required defaultValue={sub?.company} className={inputClass} />
      </Field>
      <Field label="Trade">
        <input name="trade" list="trades" defaultValue={sub?.trade} placeholder="e.g. Plumber" className={inputClass} />
      </Field>
      <Field label="Contact name">
        <input name="contact_name" defaultValue={sub?.contact_name ?? ""} className={inputClass} />
      </Field>
      <Field label="Phone">
        <input name="phone" type="tel" defaultValue={sub?.phone ?? ""} className={inputClass} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" defaultValue={sub?.email ?? ""} className={inputClass} />
      </Field>
      <Field label="License number">
        <input name="license_number" defaultValue={sub?.license_number ?? ""} className={inputClass} />
      </Field>
      <Field label="License expires">
        <input name="license_expires_on" type="date" defaultValue={sub?.license_expires_on ?? ""} className={inputClass} />
      </Field>
      <Field label="Insurance expires">
        <input name="insurance_expires_on" type="date" defaultValue={sub?.insurance_expires_on ?? ""} className={inputClass} />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <input name="notes" defaultValue={sub?.notes ?? ""} className={inputClass} />
      </Field>
    </>
  );
}

function ExpiryBadge({ state, date }: { state: string; date: string | null }) {
  if (state === "none") return <span className="text-stone-400">not on file</span>;
  const tone = state === "expired" ? "red" : state === "soon" ? "amber" : "green";
  return <Badge tone={tone}>{state === "expired" ? `expired ${formatDate(date)}` : `to ${formatDate(date)}`}</Badge>;
}
