// Frame around every page of one project: its name and the tabs. Loading the
// project here also checks the signed-in person is a member (404 otherwise).
import Link from "next/link";
import { getProjectContext } from "@/lib/project/access";
import { ProjectTabs, type Tab } from "@/components/project/ProjectTabs";

const TABS: Tab[] = [
  { href: "", label: "Overview" },
  { href: "/budget", label: "Budget" },
  { href: "/spending", label: "Spending" },
  { href: "/change-orders", label: "Change orders" },
  { href: "/waivers", label: "Lien waivers" },
  { href: "/bids", label: "Bids" },
  { href: "/subs", label: "Subs" },
  { href: "/checklist", label: "Checklist" },
  { href: "/schedule", label: "Schedule" },
  { href: "/selections", label: "Selections" },
  { href: "/photos", label: "Photos" },
  { href: "/documents", label: "Documents" },
];

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project, role } = await getProjectContext(id);
  const base = `/dashboard/projects/${project.id}`;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="space-y-3">
        <Link href="/dashboard" className="text-sm text-stone-600 underline">
          ← Your projects
        </Link>
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900">{project.name}</h1>
            {project.address && <p className="text-stone-600">{project.address}</p>}
          </div>
          {role !== "owner" && <span className="text-sm text-stone-500">You are a{role === "editor" ? "n editor" : " viewer"} on this project</span>}
        </header>
        <ProjectTabs base={base} tabs={TABS} />
      </div>
      {children}
    </main>
  );
}
