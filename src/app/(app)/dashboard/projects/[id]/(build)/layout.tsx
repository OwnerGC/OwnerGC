// Every page in this (build) folder is a Build-plan feature: budget, spending,
// bids, checklist, draws, documents. The folder name doesn't show in the URL.
// Payments (phase 3) aren't built yet, so everyone gets in for now; when they
// are, the check in hasBuildFeatures decides, and this is the only place that
// needs to show the upgrade screen.
import { getProjectContext, hasBuildFeatures } from "@/lib/project/access";

export default async function BuildFeaturesLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project, user } = await getProjectContext(id);
  if (!(await hasBuildFeatures(user.id, project.owner_id))) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 p-4 text-stone-800">
        This is part of the Build plan. Upgrade to track spending, bids, inspections, draws and documents for this project.
      </p>
    );
  }
  return children;
}
