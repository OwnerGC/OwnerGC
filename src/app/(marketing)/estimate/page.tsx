import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { inputsFromSearchParams } from "@/lib/estimator";
import { Estimator } from "@/components/marketing/Estimator";
import { SiteFooter, TopNav } from "@/components/marketing/site";

export const metadata: Metadata = {
  title: "Free cost-to-build estimator · OwnerGC",
  description: "Line-item budget, owner-builder savings, build schedule and loan draws for your house plan. Free.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function EstimatePage({ searchParams }: Props) {
  const params = await searchParams;
  const initial = inputsFromSearchParams(params);
  const error = one(params.error);
  const projectId = one(params.project);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Editing a saved project: security rules only return it to its members.
  let project: { id: string; name: string } | undefined;
  if (user && projectId) {
    const { data } = await supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle();
    if (data) project = data;
  }

  return (
    <>
      <div className="hero-band">
        <div className="wrap">
          <TopNav signedIn={!!user} />
          <header className="page-head" style={{ paddingBottom: 48 }}>
            <h1>{project ? `Estimate for ${project.name}` : "Your cost to build"}</h1>
            <p className="lead" style={{ marginBottom: 0 }}>
              Change anything and the budget, savings, schedule and loan draws update instantly.
            </p>
          </header>
        </div>
      </div>
      <section id="estimator" className="tight">
        <div className="wrap">
          {error && <p className="notice">{error}</p>}
          <Estimator initial={initial} variant="full" signedIn={!!user} project={project} />
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
