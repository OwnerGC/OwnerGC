import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { estimate, hasSavedEstimate, parseEstimateInputs, shortMoney } from "@/lib/estimator";
import { signOut } from "../login/actions";
import { createProject } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // No "where owner = me" filter needed: row-level security only returns
  // projects this user is a member of.
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, address, inputs, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-stone-900">Your projects</h1>
        <form action={signOut}>
          <button className="text-sm text-stone-600 underline">Sign out ({user.email})</button>
        </form>
      </header>

      {error && <p className="text-red-700">Could not load projects: {error.message}</p>}

      <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white">
        {projects?.length ? (
          projects.map((p) => (
            <li key={p.id}>
              <Link href={`/dashboard/projects/${p.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-stone-50">
                <span>
                  <span className="block font-medium text-stone-900">{p.name}</span>
                  {p.address && <span className="block text-sm text-stone-600">{p.address}</span>}
                </span>
                <span className="text-right text-sm text-stone-600">
                  {hasSavedEstimate(p.inputs) ? (
                    <>
                      <span className="block font-mono text-base text-stone-900">{shortMoney(estimate(parseEstimateInputs(p.inputs)).allIn)}</span>
                      all-in estimate
                    </>
                  ) : (
                    "No estimate yet"
                  )}
                </span>
              </Link>
            </li>
          ))
        ) : (
          <li className="px-4 py-3 text-stone-600">No projects yet.</li>
        )}
      </ul>

      <section className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-lg font-medium text-stone-800">Price out a new build</h2>
        <p className="text-sm text-stone-700">
          Run the free estimator for a line-item budget, your savings and a build schedule, then save it here as a project.
        </p>
        <Link href="/estimate" className="inline-block rounded-md bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700">
          Open the estimator
        </Link>
      </section>

      <form action={createProject} className="space-y-3">
        <h2 className="text-lg font-medium text-stone-800">Or start a blank project</h2>
        <input name="name" required placeholder="Project name" className="w-full rounded-md border border-stone-300 px-3 py-2" />
        <input name="address" placeholder="Site address (optional)" className="w-full rounded-md border border-stone-300 px-3 py-2" />
        <button className="rounded-md bg-stone-800 px-4 py-2 font-medium text-white hover:bg-stone-900">Create project</button>
      </form>
    </main>
  );
}
