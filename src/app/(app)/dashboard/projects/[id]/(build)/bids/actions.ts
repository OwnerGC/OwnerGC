"use server";
import { dbError, mustHaveChanged, projectAction } from "@/lib/project/actions-common";
import { dollarsToCents } from "@/lib/project/money";
import { isUuid, isoDate, optionalId, text, today } from "@/lib/project/validate";
import { SCOPE_HINTS } from "@/lib/project/bids";
import { tradeForLineKey } from "@/lib/project/budget";
import { AI_DAILY_LIMIT, AI_MAX_BYTES, aiBidCheckEnabled, runBidCheck } from "@/lib/ai/bid-check";

/** Add a bid (or a bid request). A new sub can be created on the spot. */
export async function addBid(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const lineId = formData.get("budget_line_id");
    if (!isUuid(lineId)) return { error: "Pick the budget line this bid is for." };
    const requested = formData.get("status") === "requested";
    const cents = requested ? (dollarsToCents(formData.get("amount") || "0") ?? 0) : dollarsToCents(formData.get("amount"));
    if (cents === null || cents < 0) return { error: "Enter the bid amount, like 28500." };

    let subId = optionalId(formData.get("sub_id"));
    const newCompany = text(formData.get("new_company"), 200);
    if (!subId) {
      if (!newCompany) return { error: "Pick a sub, or type a new company name." };
      const { data: line } = await supabase.from("budget_lines").select("key").eq("id", lineId).eq("project_id", projectId).maybeSingle();
      const { data: sub, error } = await supabase
        .from("subs")
        .insert({
          project_id: projectId,
          company: newCompany,
          trade: tradeForLineKey(line?.key ?? null) ?? "",
          phone: text(formData.get("new_phone"), 40),
          email: text(formData.get("new_email"), 200),
        })
        .select("id")
        .single();
      dbError(error, "sub");
      subId = sub!.id;
    }

    const { error } = await supabase.from("bids").insert({
      project_id: projectId,
      sub_id: subId,
      budget_line_id: lineId,
      amount_cents: cents,
      status: requested ? "requested" : "received",
      received_on: requested ? null : today(),
      due_on: isoDate(formData.get("due_on")),
      notes: text(formData.get("notes"), 4000),
      document_id: optionalId(formData.get("document_id")),
    });
    dbError(error, "bid");
  });
}

/** Record the price when a requested bid comes in. */
export async function receiveBid(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const id = formData.get("bid_id");
    const cents = dollarsToCents(formData.get("amount"));
    if (!isUuid(id)) return { error: "That bid could not be found." };
    if (cents === null || cents < 0) return { error: "Enter the bid amount." };
    const fields: Record<string, unknown> = { amount_cents: cents, status: "received", received_on: today() };
    const doc = optionalId(formData.get("document_id"));
    if (doc) fields.document_id = doc;
    const { data, error } = await supabase.from("bids").update(fields).eq("id", id).eq("project_id", projectId).select("id");
    dbError(error, "bid");
    mustHaveChanged(data, "bid");
  });
}

/** Award a bid. Any other award on the same line goes back to "received". */
export async function setBidStatus(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const id = formData.get("bid_id");
    const status = formData.get("status");
    if (!isUuid(id) || !["received", "awarded", "declined"].includes(String(status))) return { error: "That bid could not be found." };
    const { data: bid } = await supabase.from("bids").select("budget_line_id").eq("id", id).eq("project_id", projectId).maybeSingle();
    if (!bid) return { error: "That bid could not be found." };
    if (status === "awarded") {
      const { error } = await supabase
        .from("bids")
        .update({ status: "received" })
        .eq("project_id", projectId)
        .eq("budget_line_id", bid.budget_line_id)
        .eq("status", "awarded");
      dbError(error, "bid");
    }
    const { data, error } = await supabase.from("bids").update({ status }).eq("id", id).eq("project_id", projectId).select("id");
    dbError(error, "bid");
    mustHaveChanged(data, "bid");
  });
}

export async function deleteBid(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const id = formData.get("bid_id");
    if (!isUuid(id)) return { error: "That bid could not be found." };
    const { data, error } = await supabase.from("bids").delete().eq("id", id).eq("project_id", projectId).select("id");
    dbError(error, "bid");
    mustHaveChanged(data, "bid");
  });
}

/** Run the AI bid check on a bid's attached file and save the result on the bid. */
export async function checkBidWithAi(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId, userId }) => {
    if (!aiBidCheckEnabled()) return { error: "The AI bid check isn't switched on yet." };
    const id = formData.get("bid_id");
    if (!isUuid(id)) return { error: "That bid could not be found." };

    // Only owners and editors may run it (it costs money).
    const { data: member } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", userId).maybeSingle();
    if (!member || member.role === "viewer") return { error: "You can't run the bid check on this project." };

    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await supabase.from("bids").select("id", { count: "exact", head: true }).eq("project_id", projectId).gte("ai_reviewed_at", since);
    if ((count ?? 0) >= AI_DAILY_LIMIT) return { error: `You've run ${AI_DAILY_LIMIT} bid checks on this project today. Try again tomorrow.` };

    const { data: bid } = await supabase
      .from("bids")
      .select("id, amount_cents, document_id, budget_line_id, sub_id, budget_lines(name, key, budget_cents), subs(company, trade)")
      .eq("id", id)
      .eq("project_id", projectId)
      .maybeSingle();
    if (!bid) return { error: "That bid could not be found." };
    if (!bid.document_id) return { error: "Attach the sub's bid (PDF or photo) first." };

    const { data: doc } = await supabase.from("documents").select("storage_path, content_type, size_bytes").eq("id", bid.document_id).maybeSingle();
    if (!doc) return { error: "The bid file could not be found." };
    if (doc.size_bytes > AI_MAX_BYTES) return { error: "That file is too big for the bid check (20 MB max)." };
    if (!["application/pdf", "image/jpeg", "image/png"].includes(doc.content_type)) return { error: "The bid check reads PDFs, JPEGs and PNGs. Convert iPhone HEIC photos to JPEG first." };
    const { data: blob, error: dlError } = await supabase.storage.from("project-files").download(doc.storage_path);
    if (dlError || !blob) return { error: "Couldn't open the bid file." };

    const line = (Array.isArray(bid.budget_lines) ? bid.budget_lines[0] : bid.budget_lines) as { name: string; key: string | null; budget_cents: number } | null;
    const sub = (Array.isArray(bid.subs) ? bid.subs[0] : bid.subs) as { company: string; trade: string } | null;
    const { data: others } = await supabase
      .from("bids")
      .select("amount_cents, status, subs(company)")
      .eq("project_id", projectId)
      .eq("budget_line_id", bid.budget_line_id)
      .neq("id", id)
      .in("status", ["received", "awarded"]);

    let review;
    try {
      review = await runBidCheck({
        file: { data: await blob.arrayBuffer(), contentType: doc.content_type },
        trade: sub?.trade || tradeForLineKey(line?.key ?? null) || "",
        lineName: line?.name ?? "",
        budgetDollars: (line?.budget_cents ?? 0) / 100,
        enteredAmountDollars: bid.amount_cents / 100,
        otherBids: (others ?? []).map((o) => {
          const s = (Array.isArray(o.subs) ? o.subs[0] : o.subs) as { company: string } | null;
          return { company: s?.company ?? "Another sub", amountDollars: o.amount_cents / 100 };
        }),
        scopeHints: SCOPE_HINTS[line?.key ?? ""] ?? [],
      });
    } catch (e) {
      console.error("AI bid check failed", e);
      return { error: e instanceof Error && e.message.startsWith("The AI") ? e.message : "The bid check didn't work this time. Please try again in a minute." };
    }
    const { error } = await supabase.from("bids").update({ ai_review: review, ai_reviewed_at: new Date().toISOString() }).eq("id", id).eq("project_id", projectId);
    dbError(error, "bid check");
  });
}
