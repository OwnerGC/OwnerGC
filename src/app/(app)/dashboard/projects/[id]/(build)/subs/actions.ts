"use server";
import { dbError, mustHaveChanged, projectAction } from "@/lib/project/actions-common";
import { isUuid, isoDate, text } from "@/lib/project/validate";

function subFields(formData: FormData) {
  const email = text(formData.get("email"), 200);
  return {
    company: text(formData.get("company"), 200),
    contact_name: text(formData.get("contact_name"), 200),
    trade: text(formData.get("trade"), 100) ?? "",
    phone: text(formData.get("phone"), 40),
    email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null,
    notes: text(formData.get("notes"), 2000),
    license_number: text(formData.get("license_number"), 100),
    license_expires_on: isoDate(formData.get("license_expires_on")),
    insurance_expires_on: isoDate(formData.get("insurance_expires_on")),
  };
}

export async function addSub(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const fields = subFields(formData);
    if (!fields.company) return { error: "Enter the company or person's name." };
    const { error } = await supabase.from("subs").insert({ project_id: projectId, ...fields });
    dbError(error, "sub");
  });
}

export async function updateSub(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const id = formData.get("sub_id");
    const fields = subFields(formData);
    if (!isUuid(id)) return { error: "That sub could not be found." };
    if (!fields.company) return { error: "Enter the company or person's name." };
    const { data, error } = await supabase.from("subs").update(fields).eq("id", id).eq("project_id", projectId).select("id");
    dbError(error, "sub");
    mustHaveChanged(data, "sub");
    // A certificate uploaded with the form is filed against this sub.
    const doc = formData.get("document_id");
    if (isUuid(doc)) await supabase.from("documents").update({ sub_id: id }).eq("id", doc).eq("project_id", projectId);
  });
}

export async function deleteSub(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const id = formData.get("sub_id");
    if (!isUuid(id)) return { error: "That sub could not be found." };
    const { data, error } = await supabase.from("subs").delete().eq("id", id).eq("project_id", projectId).select("id");
    if (error?.code === "23503") return { error: "This sub has bids. Delete those first." };
    dbError(error, "sub");
    mustHaveChanged(data, "sub");
  });
}
