"use server";
import { dbError, mustHaveChanged, projectAction } from "@/lib/project/actions-common";
import { dollarsToCents } from "@/lib/project/money";
import { isoDate, isUuid, optionalId, text, today } from "@/lib/project/validate";

export async function addExpense(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const vendor = text(formData.get("vendor"), 200);
    const cents = dollarsToCents(formData.get("amount"));
    if (!vendor) return { error: "Who did you pay?" };
    if (!cents || cents <= 0) return { error: "Enter the amount, like 1250.00." };
    const { error } = await supabase.from("expenses").insert({
      project_id: projectId,
      vendor,
      amount_cents: cents,
      spent_on: isoDate(formData.get("spent_on")) ?? today(),
      budget_line_id: optionalId(formData.get("budget_line_id")),
      document_id: optionalId(formData.get("document_id")),
      note: text(formData.get("note"), 2000),
      waiver_required: formData.get("waiver_required") === "on",
    });
    dbError(error, "expense");
  });
}

export async function updateExpenseLine(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const id = formData.get("expense_id");
    if (!isUuid(id)) return { error: "That expense could not be found." };
    const { data, error } = await supabase
      .from("expenses")
      .update({ budget_line_id: optionalId(formData.get("budget_line_id")) })
      .eq("id", id)
      .eq("project_id", projectId)
      .select("id");
    dbError(error, "expense");
    mustHaveChanged(data, "expense");
  });
}

export async function attachReceipt(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const id = formData.get("expense_id");
    const doc = optionalId(formData.get("document_id"));
    if (!isUuid(id) || !doc) return { error: "Choose a file to attach." };
    const { data, error } = await supabase.from("expenses").update({ document_id: doc }).eq("id", id).eq("project_id", projectId).select("id");
    dbError(error, "receipt");
    mustHaveChanged(data, "expense");
  });
}

export async function deleteExpense(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const id = formData.get("expense_id");
    if (!isUuid(id)) return { error: "That expense could not be found." };
    const { data, error } = await supabase.from("expenses").delete().eq("id", id).eq("project_id", projectId).select("id");
    dbError(error, "expense");
    mustHaveChanged(data, "expense");
  });
}
