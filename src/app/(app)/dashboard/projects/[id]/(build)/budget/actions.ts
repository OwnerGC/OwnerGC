"use server";
import { budgetLinesFromEstimate } from "@/lib/project/budget";
import { dbError, mustHaveChanged, projectAction } from "@/lib/project/actions-common";
import { dollarsToCents } from "@/lib/project/money";
import { isUuid, text } from "@/lib/project/validate";
import { hasSavedEstimate, parseEstimateInputs } from "@/lib/estimator";

/** Create budget lines from the project's saved estimate (skips lines that already exist). */
export async function seedBudgetFromEstimate(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const { data: project } = await supabase.from("projects").select("inputs").eq("id", projectId).maybeSingle();
    if (!project) throw new Error("That project could not be found.");
    if (!hasSavedEstimate(project.inputs)) throw new Error("Save an estimate for this project first.");
    const rows = budgetLinesFromEstimate(parseEstimateInputs(project.inputs)).map((r) => ({ ...r, project_id: projectId }));
    const { error } = await supabase.from("budget_lines").upsert(rows, { onConflict: "project_id,key", ignoreDuplicates: true });
    dbError(error, "budget");
  });
}

export async function addBudgetLine(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const name = text(formData.get("name"), 200);
    const cents = dollarsToCents(formData.get("amount") || "0");
    if (!name) return { error: "Give the line a name." };
    if (cents === null) return { error: "Enter the budget as a dollar amount, like 12500." };
    const { data: last } = await supabase
      .from("budget_lines")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("budget_lines").insert({
      project_id: projectId,
      name,
      division: text(formData.get("division"), 10) ?? "",
      budget_cents: cents,
      sort_order: (last?.sort_order ?? 0) + 10,
    });
    dbError(error, "budget line");
  });
}

export async function updateBudgetLine(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const id = formData.get("line_id");
    const name = text(formData.get("name"), 200);
    const cents = dollarsToCents(formData.get("amount"));
    if (!isUuid(id)) return { error: "That line could not be found." };
    if (!name) return { error: "Give the line a name." };
    if (cents === null) return { error: "Enter the budget as a dollar amount, like 12500." };
    const { data, error } = await supabase
      .from("budget_lines")
      .update({ name, budget_cents: cents, division: text(formData.get("division"), 10) ?? "" })
      .eq("id", id)
      .eq("project_id", projectId)
      .select("id");
    dbError(error, "budget line");
    mustHaveChanged(data, "budget line");
  });
}

export async function deleteBudgetLine(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const id = formData.get("line_id");
    if (!isUuid(id)) return { error: "That line could not be found." };
    const { data, error } = await supabase.from("budget_lines").delete().eq("id", id).eq("project_id", projectId).select("id");
    if (error?.code === "23503") return { error: "This line has spending or change orders logged against it. Move or delete those first." };
    dbError(error, "budget line");
    mustHaveChanged(data, "budget line");
  });
}
