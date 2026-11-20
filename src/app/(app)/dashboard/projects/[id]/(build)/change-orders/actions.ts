"use server";
import { dbError, mustHaveChanged, projectAction } from "@/lib/project/actions-common";
import { dollarsToCents } from "@/lib/project/money";
import { isUuid, optionalId, text, today } from "@/lib/project/validate";

export async function addChangeOrder(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const title = text(formData.get("title"), 200);
    const lineId = formData.get("budget_line_id");
    const cents = dollarsToCents(formData.get("amount"), { allowNegative: true });
    if (!title) return { error: "Describe the change in a few words." };
    if (!isUuid(lineId)) return { error: "Pick the budget line this change affects." };
    if (cents === null) return { error: "Enter the amount, like 1500 (or -500 for a credit)." };

    // Next number for this project. If two people add one at the same moment
    // the database's unique rule catches it, and we try the next number.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: last } = await supabase
        .from("change_orders")
        .select("number")
        .eq("project_id", projectId)
        .order("number", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error } = await supabase.from("change_orders").insert({
        project_id: projectId,
        number: (last?.number ?? 0) + 1,
        budget_line_id: lineId,
        title,
        description: text(formData.get("description"), 4000),
        vendor: text(formData.get("vendor"), 200),
        amount_cents: cents,
        document_id: optionalId(formData.get("document_id")),
      });
      if (error?.code === "23505") continue;
      dbError(error, "change order");
      return;
    }
    return { error: "Could not number the change order. Please try again." };
  });
}

export async function decideChangeOrder(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const id = formData.get("change_order_id");
    const status = formData.get("status");
    if (!isUuid(id) || (status !== "approved" && status !== "rejected" && status !== "proposed")) return { error: "That change order could not be found." };
    const { data, error } = await supabase
      .from("change_orders")
      .update({ status, decided_on: status === "proposed" ? null : today() })
      .eq("id", id)
      .eq("project_id", projectId)
      .select("id");
    dbError(error, "change order");
    mustHaveChanged(data, "change order");
  });
}

export async function deleteChangeOrder(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const id = formData.get("change_order_id");
    if (!isUuid(id)) return { error: "That change order could not be found." };
    const { data, error } = await supabase.from("change_orders").delete().eq("id", id).eq("project_id", projectId).select("id");
    dbError(error, "change order");
    mustHaveChanged(data, "change order");
  });
}
