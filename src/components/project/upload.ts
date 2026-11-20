"use client";
// Upload one file to the project's private folder in storage. First a
// documents row is created (the database checks the type, size and that you
// can edit the project), then the file goes to the path that row claims. The
// storage bucket re-checks type and size itself, so a tampered browser can't
// sneak anything else in. If the upload fails the row is removed again.
import { createClient } from "@/lib/supabase/client";
import { checkUpload, isFolder, isPhaseKey, titleFromFilename, type Folder } from "@/lib/project/documents";
import { isUuid } from "@/lib/project/validate";

export async function uploadDocument(opts: {
  projectId: string;
  file: File;
  folder: Folder;
  title?: string;
  phase?: string;
  budgetLineId?: string;
  notes?: string;
  expiresOn?: string;
}): Promise<{ id: string } | { error: string }> {
  const check = checkUpload(opts.file);
  if (!check.ok) return { error: check.error };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };

  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      project_id: opts.projectId,
      folder: isFolder(opts.folder) ? opts.folder : "other",
      title: (opts.title?.trim() || titleFromFilename(opts.file.name)).slice(0, 200),
      phase: isPhaseKey(opts.phase) ? opts.phase : null,
      budget_line_id: isUuid(opts.budgetLineId) ? opts.budgetLineId : null,
      notes: opts.notes?.trim().slice(0, 2000) || null,
      expires_on: opts.expiresOn || null,
      content_type: check.contentType,
      size_bytes: opts.file.size,
      uploaded_by: user.id,
    })
    .select("id, storage_path")
    .single();
  if (error || !doc) return { error: "Could not save the file. You may not have permission to add files here." };

  const { error: upErr } = await supabase.storage
    .from("project-files")
    .upload(doc.storage_path, opts.file, { contentType: check.contentType, upsert: false });
  if (upErr) {
    await supabase.from("documents").delete().eq("id", doc.id);
    return { error: "The upload didn't go through. Check the file is a PDF, JPEG, PNG or HEIC under 25 MB and try again." };
  }
  return { id: doc.id };
}
