// Progress photo log: dated photos for each phase, the record lenders and
// inspectors ask for. Photos are documents in the "photos" folder, shown
// through short-lived signed links because the bucket is private.
import { getProjectContext } from "@/lib/project/access";
import { PHASES } from "@/lib/estimator";
import { PHASE_NAMES } from "@/lib/project/documents";
import { formatDate } from "@/lib/project/validate";
import { DocumentUpload } from "@/components/project/DocumentUpload";
import { Card, Empty, ViewerNote } from "@/components/project/ui";

type Photo = { id: string; title: string; phase: string | null; content_type: string; storage_path: string; created_at: string };

export default async function PhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, project, canEdit } = await getProjectContext(id);
  const { data } = await supabase
    .from("documents")
    .select("id, title, phase, content_type, storage_path, created_at")
    .eq("project_id", project.id)
    .eq("folder", "photos")
    .order("created_at", { ascending: false })
    .limit(300);
  const photos = (data ?? []) as Photo[];
  // Signed links for the thumbnails, valid for 10 minutes.
  const viewable = photos.filter((p) => p.content_type === "image/jpeg" || p.content_type === "image/png");
  const { data: signed } = viewable.length
    ? await supabase.storage.from("project-files").createSignedUrls(viewable.map((p) => p.storage_path), 600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  const groups = [...PHASES.map((p) => p.key), null].map((key) => ({ key, photos: photos.filter((p) => p.phase === key) })).filter((g) => g.photos.length);

  return (
    <div className="space-y-6">
      <ViewerNote canEdit={canEdit} />
      {canEdit && (
        <Card title="Add progress photos">
          <DocumentUpload projectId={project.id} defaultFolder="photos" lockFolder />
        </Card>
      )}
      {photos.length === 0 && (
        <Card>
          <Empty>No photos yet. Snap the footings, framing, rough-ins and anything that gets covered up. Lenders and inspectors ask for them.</Empty>
        </Card>
      )}
      {groups.map((g) => (
        <Card key={g.key ?? "none"} title={g.key ? PHASE_NAMES[g.key] : "No phase"}>
          <ul className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4">
            {g.photos.map((p) => {
              const url = urlByPath.get(p.storage_path);
              return (
                <li key={p.id}>
                  <a href={`/dashboard/projects/${project.id}/files/${p.id}`} target="_blank" rel="noopener" className="block space-y-1">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed links change every load, so Next's image optimizer can't cache them
                      <img src={url} alt={p.title} loading="lazy" className="aspect-square w-full rounded-md border border-stone-200 object-cover" />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center rounded-md border border-stone-200 bg-stone-100 text-xs text-stone-500">
                        {p.content_type === "application/pdf" ? "PDF" : "HEIC photo (tap to open)"}
                      </div>
                    )}
                    <div className="truncate text-xs text-stone-700">{p.title}</div>
                    <div className="text-xs text-stone-500">{formatDate(p.created_at)}</div>
                  </a>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
