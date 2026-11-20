// Every file for the build, in folders, by phase, and searchable, so you can
// pull up the permit or the plans on your phone at the job site.
import Link from "next/link";
import { getProjectContext } from "@/lib/project/access";
import { FOLDERS, PHASE_NAMES, formatBytes, isFolder, isPhaseKey, likePattern, type Folder } from "@/lib/project/documents";
import { daysBetween, formatDate, today } from "@/lib/project/validate";
import { ActionForm } from "@/components/project/ActionForm";
import { DocumentUpload } from "@/components/project/DocumentUpload";
import { Badge, Card, Empty, ViewerNote, dangerLinkClass, inputClass, secondaryButtonClass } from "@/components/project/ui";
import { deleteDocument, updateDocument } from "./actions";

type Doc = {
  id: string;
  folder: Folder;
  phase: string | null;
  title: string;
  notes: string | null;
  expires_on: string | null;
  content_type: string;
  size_bytes: number;
  created_at: string;
};

type Search = { folder?: string; phase?: string; q?: string };

export default async function DocumentsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, project, canEdit } = await getProjectContext(id);
  const folder = isFolder(sp.folder) ? sp.folder : null;
  const phase = isPhaseKey(sp.phase) ? sp.phase : null;
  const q = (sp.q ?? "").trim().slice(0, 100);

  let query = supabase
    .from("documents")
    .select("id, folder, phase, title, notes, expires_on, content_type, size_bytes, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false })
    .limit(500);
  if (folder) query = query.eq("folder", folder);
  if (phase) query = query.eq("phase", phase);
  if (q) query = query.or(`title.ilike.${quoteFilter(likePattern(q))},notes.ilike.${quoteFilter(likePattern(q))}`);
  const [{ data }, { data: counts }] = await Promise.all([query, supabase.from("documents").select("folder").eq("project_id", project.id)]);
  const docs = (data ?? []) as Doc[];
  const perFolder = new Map<string, number>();
  for (const r of counts ?? []) perFolder.set(r.folder, (perFolder.get(r.folder) ?? 0) + 1);

  const base = `/dashboard/projects/${project.id}/documents`;
  const link = (patch: Search) => {
    const p = new URLSearchParams();
    const next = { folder: folder ?? undefined, phase: phase ?? undefined, q: q || undefined, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  const now = today();

  return (
    <div className="space-y-6">
      <ViewerNote canEdit={canEdit} />

      <form action={base} className="flex flex-wrap gap-2">
        {folder && <input type="hidden" name="folder" value={folder} />}
        <input name="q" defaultValue={q} placeholder="Search titles and notes" className={`${inputClass} max-w-sm`} />
        <select name="phase" defaultValue={phase ?? ""} className={`${inputClass} max-w-48`} aria-label="Phase">
          <option value="">All phases</option>
          {Object.entries(PHASE_NAMES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className={secondaryButtonClass}>Search</button>
      </form>

      <div className="grid gap-6 md:grid-cols-[12rem_1fr]">
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          <FolderLink href={link({ folder: undefined })} active={!folder} label="All files" count={counts?.length ?? 0} />
          {Object.entries(FOLDERS).map(([k, v]) => (
            <FolderLink key={k} href={link({ folder: k })} active={folder === k} label={v} count={perFolder.get(k) ?? 0} />
          ))}
        </nav>

        <div className="space-y-6">
          <Card title={folder ? FOLDERS[folder] : "All files"} actions={q || phase ? <Link href={link({ q: undefined, phase: undefined })} className="text-sm text-stone-600 underline">Clear search</Link> : null}>
            {docs.length === 0 ? (
              <Empty>{q || phase || folder ? "No files match." : "No files yet. Upload plans, permits, contracts and photos below."}</Empty>
            ) : (
              <ul className="divide-y divide-stone-100">
                {docs.map((d) => {
                  const days = d.expires_on ? daysBetween(now, d.expires_on) : null;
                  return (
                    <li key={d.id} className="space-y-1 px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <a href={`/dashboard/projects/${project.id}/files/${d.id}`} target="_blank" rel="noopener" className="font-medium text-stone-900 underline decoration-stone-300">
                          {d.title}
                        </a>
                        <span className="text-xs text-stone-500">
                          {d.content_type === "application/pdf" ? "PDF" : "Image"} · {formatBytes(d.size_bytes)} · {formatDate(d.created_at)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-stone-600">
                        <Badge>{FOLDERS[d.folder]}</Badge>
                        {d.phase && <Badge tone="blue">{PHASE_NAMES[d.phase]}</Badge>}
                        {days !== null && (
                          <Badge tone={days < 0 ? "red" : days <= 30 ? "amber" : "green"}>
                            {days < 0 ? `Expired ${formatDate(d.expires_on)}` : `Expires ${formatDate(d.expires_on)}`}
                          </Badge>
                        )}
                        {d.notes && <span>{d.notes}</span>}
                      </div>
                      {canEdit && (
                        <details>
                          <summary className="cursor-pointer text-xs text-stone-500">Edit</summary>
                          <ActionForm action={updateDocument} projectId={project.id} resetOnSuccess={false} className="mt-2 grid max-w-xl gap-2 sm:grid-cols-2">
                            <input type="hidden" name="document_id" value={d.id} />
                            <input name="title" defaultValue={d.title} required className={inputClass} aria-label="Title" />
                            <select name="folder" defaultValue={d.folder} className={inputClass} aria-label="Folder">
                              {Object.entries(FOLDERS).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                            <select name="phase" defaultValue={d.phase ?? ""} className={inputClass} aria-label="Phase">
                              <option value="">Whole project</option>
                              {Object.entries(PHASE_NAMES).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                            <input name="expires_on" type="date" defaultValue={d.expires_on ?? ""} className={inputClass} aria-label="Expires on" />
                            <input name="notes" defaultValue={d.notes ?? ""} placeholder="Notes" className={`${inputClass} sm:col-span-2`} />
                            <div className="flex items-center gap-4 sm:col-span-2">
                              <button className={secondaryButtonClass}>Save</button>
                            </div>
                          </ActionForm>
                          <ActionForm action={deleteDocument} projectId={project.id} confirm={`Delete "${d.title}" for good?`} className="mt-1">
                            <input type="hidden" name="document_id" value={d.id} />
                            <button className={dangerLinkClass}>Delete file</button>
                          </ActionForm>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {canEdit && (
            <Card title="Upload files">
              <DocumentUpload projectId={project.id} defaultFolder={folder ?? "other"} defaultPhase={phase ?? ""} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function FolderLink({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-3 whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
        active ? "bg-amber-100 font-medium text-stone-900" : "text-stone-700 hover:bg-stone-100"
      }`}
    >
      {label}
      <span className="text-xs text-stone-500">{count}</span>
    </Link>
  );
}

/** Wrap a value for a PostgREST or() filter so commas and brackets in a search can't break out of it. */
function quoteFilter(v: string) {
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
