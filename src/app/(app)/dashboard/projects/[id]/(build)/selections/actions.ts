"use server";
import { dbError, mustHaveChanged, projectAction } from "@/lib/project/actions-common";
import { dollarsToCents } from "@/lib/project/money";
import { isUuid, isoDate, optionalId, text } from "@/lib/project/validate";

const STATUSES = ["choosing", "selected", "ordered", "installed"];

function fields(formData: FormData) {
  const actualRaw = formData.get("actual");
  const actual = typeof actualRaw === "string" && actualRaw.trim() ? dollarsToCents(actualRaw) : null;
  const status = String(formData.get("status") ?? "choosing");
  return {
    item: text(formData.get("item"), 200),
    category: text(formData.get("category"), 100) ?? "",
    allowance_cents: dollarsToCents(formData.get("allowance") || "0"),
    actual_cents: actual,
    status: STATUSES.includes(status) ? status : "choosing",
    vendor: text(formData.get("vendor"), 200),
    due_on: isoDate(formData.get("due_on")),
    budget_line_id: optionalId(formData.get("budget_line_id")),
    notes: text(formData.get("notes"), 2000),
  };
}

export async function addSelection(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const f = fields(formData);
    if (!f.item) return { error: "What are you choosing? (e.g. Kitchen faucet)" };
    if (f.allowance_cents === null) return { error: "Enter the allowance as a dollar amount." };
    const { error } = await supabase.from("selections").insert({ project_id: projectId, ...f, document_id: optionalId(formData.get("document_id")) });
    dbError(error, "selection");
  });
}

export async function updateSelection(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const id = formData.get("selection_id");
    const f = fields(formData);
    if (!isUuid(id)) return { error: "That selection could not be found." };
    if (!f.item) return { error: "Give the selection a name." };
    if (f.allowance_cents === null) return { error: "Enter the allowance as a dollar amount." };
    const doc = optionalId(formData.get("document_id"));
    const { data, error } = await supabase
      .from("selections")
      .update({ ...f, ...(doc ? { document_id: doc } : {}) })
      .eq("id", id)
      .eq("project_id", projectId)
      .select("id");
    dbError(error, "selection");
    mustHaveChanged(data, "selection");
  });
}

export async function deleteSelection(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const id = formData.get("selection_id");
    if (!isUuid(id)) return { error: "That selection could not be found." };
    const { data, error } = await supabase.from("selections").delete().eq("id", id).eq("project_id", projectId).select("id");
    dbError(error, "selection");
    mustHaveChanged(data, "selection");
  });
}
