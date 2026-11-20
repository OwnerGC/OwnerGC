// Shared plumbing for server actions on a project. Every action re-checks the
// signed-in user on the server and then talks to the database AS that user, so
// row-level security decides what they can change.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "./validate";

export type ActionResult = { error?: string; ok?: boolean };

export async function projectAction(
  formData: FormData,
  run: (ctx: { supabase: Awaited<ReturnType<typeof createClient>>; projectId: string; userId: string }) => Promise<ActionResult | void>,
): Promise<ActionResult> {
  const projectId = formData.get("project_id");
  if (!isUuid(projectId)) return { error: "That project could not be found." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again." };
  try {
    const result = await run({ supabase, projectId, userId: user.id });
    revalidatePath(`/dashboard/projects/${projectId}`, "layout");
    return result ?? { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong. Please try again." };
  }
}

/** Turn a database error into something a person can read. */
export function dbError(error: { message: string; code?: string } | null, what: string): never | void {
  if (!error) return;
  if (error.code === "42501" || /row-level security/i.test(error.message)) {
    throw new Error(`You don't have permission to change ${what} on this project.`);
  }
  if (error.code === "23503") throw new Error(`That ${what} is still in use, or points at something that no longer exists.`);
  if (error.code === "23505") throw new Error(`That ${what} already exists.`);
  if (error.code === "23514") throw new Error(`Some of the ${what} details aren't allowed. Check the amounts and dates.`);
  throw new Error(`Could not save the ${what}. Please try again.`);
}

/** Check an update or delete actually touched a row (RLS hides failures as "0 rows"). */
export function mustHaveChanged(data: unknown[] | null, what: string) {
  if (!data?.length) throw new Error(`That ${what} could not be found, or you can't change it.`);
}
