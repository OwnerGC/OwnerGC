"use server";
import { isWaiverType } from "@/lib/project/budget";
import { dbError, mustHaveChanged, projectAction } from "@/lib/project/actions-common";
import { isUuid, isoDate, optionalId, today } from "@/lib/project/validate";

/** Record a waiver as requested or received for one payment. */
export async function saveWaiver(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const expenseId = formData.get("expense_id");
    const status = formData.get("status") === "received" ? "received" : "requested";
    const type = formData.get("waiver_type");
    if (!isUuid(expenseId)) return { error: "That payment could not be found." };
    const fields = {
      status,
      waiver_type: isWaiverType(type) ? type : "conditional_progress",
      received_on: status === "received" ? (isoDate(formData.get("received_on")) ?? today()) : null,
      ...(optionalId(formData.get("document_id")) ? { document_id: optionalId(formData.get("document_id")) } : {}),
    };
    const { data: existing } = await supabase.from("lien_waivers").select("id").eq("expense_id", expenseId).eq("project_id", projectId).maybeSingle();
    if (existing) {
      const { data, error } = await supabase.from("lien_waivers").update(fields).eq("id", existing.id).select("id");
      dbError(error, "lien waiver");
      mustHaveChanged(data, "lien waiver");
    } else {
      const { error } = await supabase.from("lien_waivers").insert({ project_id: projectId, expense_id: expenseId, ...fields });
      dbError(error, "lien waiver");
    }
  });
}

/** Some payments (permit fees, store runs) don't need a waiver. */
export async function setWaiverRequired(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const expenseId = formData.get("expense_id");
    if (!isUuid(expenseId)) return { error: "That payment could not be found." };
    const { data, error } = await supabase
      .from("expenses")
      .update({ waiver_required: formData.get("required") === "true" })
      .eq("id", expenseId)
      .eq("project_id", projectId)
      .select("id");
    dbError(error, "payment");
    mustHaveChanged(data, "payment");
  });
}
