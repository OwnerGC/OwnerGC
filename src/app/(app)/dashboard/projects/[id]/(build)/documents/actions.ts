"use server";
import { dbError, mustHaveChanged, projectAction } from "@/lib/project/actions-common";
import { isFolder, isPhaseKey } from "@/lib/project/documents";
import { isUuid, isoDate, text } from "@/lib/project/validate";

export async function updateDocument(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const id = formData.get("document_id");
    const title = text(formData.get("title"), 200);
    const folder = formData.get("folder");
    const phase = formData.get("phase");
    if (!isUuid(id)) return { error: "That file could not be found." };
    if (!title) return { error: "Give the file a title." };
    const { data, error } = await supabase
      .from("documents")
      .update({
        title,
        folder: isFolder(folder) ? folder : "other",
        phase: isPhaseKey(phase) ? phase : null,
        expires_on: isoDate(formData.get("expires_on")),
        notes: text(formData.get("notes"), 2000),
      })
      .eq("id", id)
      .eq("project_id", projectId)
      .select("id");
    dbError(error, "file");
    mustHaveChanged(data, "file");
  });
}

/** Delete the file from storage, then its row. */
export async function deleteDocument(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const id = formData.get("document_id");
    if (!isUuid(id)) return { error: "That file could not be found." };
    const { data: doc } = await supabase.from("documents").select("storage_path").eq("id", id).eq("project_id", projectId).maybeSingle();
    if (!doc) return { error: "That file could not be found." };
    const { error: storageError } = await supabase.storage.from("project-files").remove([doc.storage_path]);
    if (storageError) return { error: "Could not delete the file. You may not have permission." };
    const { data, error } = await supabase.from("documents").delete().eq("id", id).eq("project_id", projectId).select("id");
    dbError(error, "file");
    mustHaveChanged(data, "file");
  });
}
