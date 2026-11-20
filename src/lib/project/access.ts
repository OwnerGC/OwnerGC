// Loads a project for a page or action and works out what the signed-in person
// may do with it. Row-level security in the database is the real gatekeeper;
// this is so pages can hide buttons a viewer can't use and show a clean 404.
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "./validate";

export type ProjectRole = "owner" | "editor" | "viewer";

export const getProjectContext = cache(async (projectId: string) => {
  if (!isUuid(projectId)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: project }, { data: member }] = await Promise.all([
    supabase.from("projects").select("id, name, address, inputs, owner_id").eq("id", projectId).maybeSingle(),
    supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!project || !member) notFound();

  const role = member.role as ProjectRole;
  return { supabase, user, project, role, canEdit: role === "owner" || role === "editor" };
});

/**
 * Where the paywall will go once payments (phase 3) exist: true when the
 * project's owner has a Build or Pro plan. Every Build-plan page goes through
 * the (build) layout, which calls this, so gating is a change in one place.
 */
export async function hasBuildFeatures(viewerId: string, ownerId: string): Promise<boolean> {
  void viewerId;
  void ownerId;
  return true;
}
