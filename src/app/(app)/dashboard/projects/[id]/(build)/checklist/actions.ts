"use server";
import { dbError, mustHaveChanged, projectAction } from "@/lib/project/actions-common";
import { defaultTasks } from "@/lib/project/schedule";
import { isPhaseKey } from "@/lib/project/documents";
import { isUuid, isoDate, text, today } from "@/lib/project/validate";

export async function seedChecklist(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const rows = defaultTasks().map((t) => ({ ...t, project_id: projectId }));
    const { error } = await supabase.from("tasks").upsert(rows, { onConflict: "project_id,key", ignoreDuplicates: true });
    dbError(error, "checklist");
  });
}

export async function toggleTask(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const id = formData.get("task_id");
    if (!isUuid(id)) return { error: "That task could not be found." };
    const done = formData.get("done") === "true";
    const { data, error } = await supabase
      .from("tasks")
      .update({ done_at: done ? (isoDate(formData.get("done_at")) ?? today()) : null })
      .eq("id", id)
      .eq("project_id", projectId)
      .select("id");
    dbError(error, "task");
    mustHaveChanged(data, "task");
  });
}

export async function updateTask(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const id = formData.get("task_id");
    const title = text(formData.get("title"), 200);
    if (!isUuid(id)) return { error: "That task could not be found." };
    if (!title) return { error: "Give the task a name." };
    const { data, error } = await supabase
      .from("tasks")
      .update({ title, due_date: isoDate(formData.get("due_date")), is_inspection: formData.get("is_inspection") === "on", notes: text(formData.get("notes"), 2000) })
      .eq("id", id)
      .eq("project_id", projectId)
      .select("id");
    dbError(error, "task");
    mustHaveChanged(data, "task");
  });
}

export async function addTask(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const title = text(formData.get("title"), 200);
    const phase = formData.get("phase");
    if (!title) return { error: "Give the task a name." };
    if (!isPhaseKey(phase)) return { error: "Pick a phase." };
    const { data: last } = await supabase
      .from("tasks")
      .select("sort_order")
      .eq("project_id", projectId)
      .eq("phase", phase)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("tasks").insert({
      project_id: projectId,
      phase,
      title,
      is_inspection: formData.get("is_inspection") === "on",
      due_date: isoDate(formData.get("due_date")),
      sort_order: (last?.sort_order ?? 0) + 1,
    });
    dbError(error, "task");
  });
}

export async function deleteTask(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const id = formData.get("task_id");
    if (!isUuid(id)) return { error: "That task could not be found." };
    const { data, error } = await supabase.from("tasks").delete().eq("id", id).eq("project_id", projectId).select("id");
    dbError(error, "task");
    mustHaveChanged(data, "task");
  });
}

export async function setStartDate(formData: FormData) {
  return projectAction(formData, async ({ supabase, projectId }) => {
    const d = isoDate(formData.get("start_date"));
    if (!d) return { error: "Pick a start date." };
    const { data, error } = await supabase.from("projects").update({ start_date: d }).eq("id", projectId).select("id");
    dbError(error, "start date");
    mustHaveChanged(data, "project");
  });
}
