// Bids: collect them per budget line, compare side by side, award one. The
// awarded bid becomes the line's committed cost on the Budget tab.
import { getProjectContext } from "@/lib/project/access";
import { loadBudget, loadSubsAndBids } from "@/lib/project/load";
import { compareBids, type AiReview, type BidRow, type SubRow } from "@/lib/project/bids";
import { tradeForLineKey } from "@/lib/project/budget";
import { formatCents } from "@/lib/project/money";
import { ACCEPT } from "@/lib/project/documents";
import { formatDate } from "@/lib/project/validate";
import { aiBidCheckEnabled } from "@/lib/ai/bid-check";
import { ActionForm } from "@/components/project/ActionForm";
import { Badge, Card, Empty, Field, FileLink, TextLink, ViewerNote, buttonClass, dangerLinkClass, inputClass, secondaryButtonClass } from "@/components/project/ui";
import { addBid, checkBidWithAi, deleteBid, receiveBid, setBidStatus } from "./actions";

export default async function BidsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ line?: string }> }) {
  const { id } = await params;
  const { line: lineParam } = await searchParams;
  const { supabase, project, canEdit } = await getProjectContext(id);
  const [{ lines }, { subs, bids }] = await Promise.all([loadBudget(supabase, project.id), loadSubsAndBids(supabase, project.id)]);
  const subById = new Map(subs.map((s) => [s.id, s]));
  const linesWithBids = lines.filter((l) => bids.some((b) => b.budget_line_id === l.id));
  const aiOn = aiBidCheckEnabled();
  const base = `/dashboard/projects/${project.id}`;

  if (lines.length === 0) {
    return (
      <p className="rounded-md bg-amber-50 p-3 text-sm text-stone-800">
        Set up your <TextLink href={`${base}/budget`}>budget</TextLink> first. Each bid is for one budget line, so you can compare it with what you planned.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <ViewerNote canEdit={canEdit} />

      {canEdit && (
        <Card title="Add a bid">
          <ActionForm action={addBid} projectId={project.id} upload={{ folder: "bids", lineField: "budget_line_id" }} className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label="Budget line">
              <select name="budget_line_id" required defaultValue={lineParam ?? ""} className={inputClass}>
                <option value="" disabled>
                  Choose…
                </option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="From">
              <select name="sub_id" defaultValue="" className={inputClass}>
                <option value="">A new sub (type below)</option>
                {subs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.company}
                    {s.trade ? ` (${s.trade})` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="New sub's company">
              <input name="new_company" placeholder="Only if not in the list" className={inputClass} />
            </Field>
            <Field label="New sub's phone">
              <input name="new_phone" type="tel" className={inputClass} />
            </Field>
            <Field label="Bid amount ($)">
              <input name="amount" inputMode="decimal" placeholder="28500" className={inputClass} />
            </Field>
            <Field label="Bid file (PDF or photo)">
              <input name="file" type="file" accept={ACCEPT} className="block w-full text-sm" />
            </Field>
            <Field label="Status">
              <select name="status" className={inputClass}>
                <option value="received">I have the bid</option>
                <option value="requested">I&apos;ve asked for it (no price yet)</option>
              </select>
            </Field>
            <Field label="Due by (for requested bids)">
              <input name="due_on" type="date" className={inputClass} />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <input name="notes" className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <button className={buttonClass}>Save bid</button>
            </div>
          </ActionForm>
        </Card>
      )}

      {linesWithBids.length === 0 && (
        <Card>
          <Empty>No bids yet. Get at least three for each big trade, then compare them here.</Empty>
        </Card>
      )}

      {linesWithBids.map((line) => {
        const c = compareBids(line.id, line.budget_cents, bids);
        return (
          <Card
            key={line.id}
            title={
              <span>
                {line.name} <span className="font-normal text-stone-500">· budget {formatCents(line.budget_cents, { whole: true })}</span>
              </span>
            }
            actions={c.awarded ? <Badge tone="green">Awarded to {subById.get(c.awarded.sub_id)?.company}</Badge> : <Badge tone="amber">Not awarded</Badge>}
          >
            <ul className="divide-y divide-stone-100">
              {c.bids.map((b) => {
                const sub = subById.get(b.sub_id);
                return (
                  <li key={b.id} className="space-y-2 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-stone-900">{sub?.company ?? "Unknown sub"}</span>
                          <StatusBadge bid={b} />
                          {b.isLowest && c.bids.filter((x) => x.status !== "requested" && x.status !== "declined").length > 1 && <Badge tone="blue">Lowest</Badge>}
                        </div>
                        <div className="text-stone-600">
                          {b.status === "requested" ? (b.due_on ? `Due ${formatDate(b.due_on)}` : "Waiting on a price") : b.received_on ? `Received ${formatDate(b.received_on)}` : null}
                          {sub?.phone && (
                            <>
                              {" · "}
                              <a href={`tel:${sub.phone.replace(/[^\d+]/g, "")}`} className="text-amber-700 underline">
                                {sub.phone}
                              </a>
                            </>
                          )}
                        </div>
                        {b.notes && <p className="text-stone-700">{b.notes}</p>}
                        <FileLink projectId={project.id} documentId={b.document_id}>
                          View bid
                        </FileLink>
                      </div>
                      {b.status !== "requested" && (
                        <div className="text-right">
                          <div className="font-mono text-base text-stone-900">{formatCents(b.amount_cents, { whole: true })}</div>
                          <div className={`text-xs ${b.vsBudgetCents > 0 ? "text-red-700" : "text-green-700"}`}>
                            {b.vsBudgetCents === 0 ? "on budget" : `${formatCents(Math.abs(b.vsBudgetCents), { whole: true })} ${b.vsBudgetCents > 0 ? "over" : "under"} budget`}
                          </div>
                          {b.vsLowestCents > 0 && <div className="text-xs text-stone-500">+{formatCents(b.vsLowestCents, { whole: true })} vs. lowest</div>}
                        </div>
                      )}
                    </div>

                    {b.ai_review && <AiReviewPanel review={b.ai_review} enteredCents={b.amount_cents} reviewedAt={b.ai_reviewed_at} />}

                    {canEdit && (
                      <div className="flex flex-wrap items-center gap-2">
                        {b.status === "requested" ? (
                          <ActionForm action={receiveBid} projectId={project.id} upload={{ folder: "bids" }} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="bid_id" value={b.id} />
                            <input name="amount" required inputMode="decimal" placeholder="Amount $" className={inputClass.replace("w-full", "w-32")} />
                            <input name="file" type="file" accept={ACCEPT} className="text-sm" />
                            <button className={secondaryButtonClass}>Bid came in</button>
                          </ActionForm>
                        ) : (
                          <>
                            {b.status !== "awarded" && (
                              <StatusButton bidId={b.id} projectId={project.id} status="awarded" label="Award" confirm={`Award ${line.name} to ${sub?.company}? This becomes the committed cost.`} />
                            )}
                            {b.status === "awarded" && <StatusButton bidId={b.id} projectId={project.id} status="received" label="Undo award" />}
                            {b.status !== "declined" && b.status !== "awarded" && <StatusButton bidId={b.id} projectId={project.id} status="declined" label="Decline" />}
                            {b.status === "declined" && <StatusButton bidId={b.id} projectId={project.id} status="received" label="Reconsider" />}
                            {aiOn && b.document_id && (
                              <ActionForm action={checkBidWithAi} projectId={project.id}>
                                <input type="hidden" name="bid_id" value={b.id} />
                                <button className={secondaryButtonClass}>{b.ai_review ? "Re-check with AI" : "Check this bid with AI"}</button>
                              </ActionForm>
                            )}
                          </>
                        )}
                        <ActionForm action={deleteBid} projectId={project.id} confirm="Delete this bid?">
                          <input type="hidden" name="bid_id" value={b.id} />
                          <button className={dangerLinkClass}>Delete</button>
                        </ActionForm>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}

      {!aiOn && (
        <p className="text-xs text-stone-500">
          Coming soon: AI bid check. Upload a sub&apos;s bid and the AI lists its line items, what&apos;s excluded, scope that looks missing, and
          questions to ask before you sign.
        </p>
      )}

      <BidRequestTemplate projectName={project.name} address={project.address} lines={lines} subs={subs} />
    </div>
  );
}

function StatusBadge({ bid }: { bid: BidRow }) {
  const map = {
    requested: <Badge tone="stone">Requested</Badge>,
    received: <Badge tone="blue">Received</Badge>,
    awarded: <Badge tone="green">Awarded</Badge>,
    declined: <Badge tone="stone">Declined</Badge>,
  };
  return map[bid.status];
}

function StatusButton({ bidId, projectId, status, label, confirm }: { bidId: string; projectId: string; status: string; label: string; confirm?: string }) {
  return (
    <ActionForm action={setBidStatus} projectId={projectId} confirm={confirm}>
      <input type="hidden" name="bid_id" value={bidId} />
      <input type="hidden" name="status" value={status} />
      <button className={secondaryButtonClass}>{label}</button>
    </ActionForm>
  );
}

function AiReviewPanel({ review, enteredCents, reviewedAt }: { review: AiReview; enteredCents: number; reviewedAt: string | null }) {
  const mismatch = review.total_cents !== null && Math.abs(review.total_cents - enteredCents) > 100;
  const List = ({ title, items, tone }: { title: string; items: string[]; tone?: string }) =>
    items.length ? (
      <div>
        <div className={`font-medium ${tone ?? "text-stone-800"}`}>{title}</div>
        <ul className="ml-5 list-disc text-stone-700">
          {items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
    ) : null;
  return (
    <details className="rounded-md border border-sky-200 bg-sky-50 p-3" open={!!review.missing_scope.length || !!review.red_flags.length}>
      <summary className="cursor-pointer font-medium text-sky-900">
        AI bid check
        {review.missing_scope.length > 0 && ` · ${review.missing_scope.length} possible gap${review.missing_scope.length === 1 ? "" : "s"}`}
        {review.red_flags.length > 0 && ` · ${review.red_flags.length} red flag${review.red_flags.length === 1 ? "" : "s"}`}
      </summary>
      <div className="mt-2 space-y-3">
        <p className="text-stone-800">{review.summary}</p>
        {mismatch && (
          <p className="rounded bg-amber-100 px-2 py-1 text-amber-900">
            The bid&apos;s total reads as {formatCents(review.total_cents!, { whole: true })}, but you entered {formatCents(enteredCents, { whole: true })}. Double-check.
          </p>
        )}
        <List title="Red flags" items={review.red_flags} tone="text-red-800" />
        <List title="Possibly missing" items={review.missing_scope} tone="text-amber-900" />
        <List title="Excluded" items={review.exclusions} />
        <List title="Ask the sub" items={review.questions} />
        <List title="Included" items={review.inclusions} />
        {review.line_items.length > 0 && (
          <table className="w-full text-xs">
            <tbody>
              {review.line_items.map((l, i) => (
                <tr key={i} className="border-t border-sky-100">
                  <td className="py-1 pr-2 text-stone-700">{l.description}</td>
                  <td className="py-1 text-right font-mono">{l.amount_cents === null ? "–" : formatCents(l.amount_cents, { whole: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-stone-500">
          Read by AI {reviewedAt ? formatDate(reviewedAt) : ""}. It can miss things or misread a scan, so check against the bid itself.
        </p>
      </div>
    </details>
  );
}

function BidRequestTemplate({ projectName, address, lines, subs }: { projectName: string; address: string | null; lines: { id: string; key: string | null; name: string }[]; subs: SubRow[] }) {
  const body = (lineName: string) =>
    [
      "Hi,",
      "",
      `I'm building a new house${address ? ` at ${address}` : ""} as an owner-builder and would like a bid for ${lineName.toLowerCase()}.`,
      "",
      "Plans are attached. Please include:",
      "- An itemized price (labor and materials)",
      "- What's included and excluded",
      "- Your schedule and how long the work takes",
      "- Payment terms",
      "- A copy of your license and certificate of insurance",
      "",
      "Could you get it to me within two weeks?",
      "",
      "Thanks,",
    ].join("\n");
  const withEmail = subs.filter((s) => s.email);
  return (
    <Card title="Ask for a bid">
      <div className="space-y-3 p-4 text-sm">
        <p className="text-stone-700">A ready-to-send request. Attach your plans before you send it.</p>
        <pre className="whitespace-pre-wrap rounded-md bg-stone-50 p-3 font-sans text-stone-800">{body(lines[0]?.name ?? "the work")}</pre>
        {withEmail.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {withEmail.map((s) => {
              const line = lines.find((l) => tradeForLineKey(l.key) === s.trade) ?? lines[0];
              const href = `mailto:${s.email}?subject=${encodeURIComponent(`Bid request: ${line?.name ?? ""} for ${projectName}`)}&body=${encodeURIComponent(body(line?.name ?? "the work"))}`;
              return (
                <a key={s.id} href={href} className={secondaryButtonClass}>
                  Email {s.company}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
