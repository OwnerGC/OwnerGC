"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createProject(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  if (!name) return;

  const supabase = await createClient();
  // owner_id is filled in by the database from the signed-in user, and the
  // security rules reject any attempt to set it to someone else.
  const { error } = await supabase.from("projects").insert({ name, address });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}
