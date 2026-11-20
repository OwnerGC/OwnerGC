"use server";
// Saving an estimate to the signed-in person's account. Runs on the server:
// the inputs are re-checked here (never trust the browser), and the database's
// security rules decide which projects this person may create or change.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { inputsToSearchParams, parseEstimateInputs, toStoredInputs } from "@/lib/estimator";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveEstimate(formData: FormData) {
  let raw: unknown = {};
  try {
    raw = JSON.parse(String(formData.get("inputs") ?? "{}"));
  } catch {
    // Unreadable inputs fall back to the default example below.
  }
  const inputs = parseEstimateInputs(raw);
  const name = String(formData.get("name") ?? "").trim().slice(0, 200) || "My house build";
  const projectId = String(formData.get("projectId") ?? "");

  const params = inputsToSearchParams(inputs);
  if (projectId) params.set("project", projectId);
  const back = (error: string): never => {
    params.set("error", error);
    redirect(`/estimate?${params}`);
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/estimate?${params}`)}`);

  let id: string;
  if (projectId) {
    if (!UUID.test(projectId)) back("That project could not be found.");
    // Row-level security only lets owners and editors change a project; for
    // anyone else this matches no rows.
    const { data, error } = await supabase
      .from("projects")
      .update({ name, inputs: toStoredInputs(inputs) })
      .eq("id", projectId)
      .select("id");
    if (error) back("Could not save your changes. Please try again.");
    if (!data?.length) back("That project could not be found, or you can't edit it.");
    id = projectId;
  } else {
    const { data, error } = await supabase
      .from("projects")
      .insert({ name, inputs: toStoredInputs(inputs) })
      .select("id")
      .single();
    if (error || !data) back("Could not save your project. Please try again.");
    id = data!.id;
  }

  redirect(`/dashboard/projects/${id}`);
}
