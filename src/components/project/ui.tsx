// Small building blocks shared by the project pages, so they look alike.
import Link from "next/link";

export const inputClass =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-amber-600 focus:outline-none disabled:bg-stone-100";
export const buttonClass =
  "rounded-md bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50";
export const secondaryButtonClass =
  "rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50";
export const dangerLinkClass = "text-sm text-red-700 underline hover:text-red-900 disabled:opacity-50";

export function Card({ title, actions, children, className = "" }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-md border border-stone-200 bg-white ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3">
          {title && <h2 className="font-medium text-stone-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "bad" | "warn" | "good" }) {
  const color = tone === "bad" ? "text-red-700" : tone === "warn" ? "text-amber-700" : tone === "good" ? "text-green-700" : "text-stone-900";
  return (
    <div className="rounded-md border border-stone-200 bg-white p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</div>
      <div className={`mt-1 font-mono text-xl ${color}`}>{value}</div>
      {note && <div className="text-xs text-stone-500">{note}</div>}
    </div>
  );
}

const BADGE = {
  red: "bg-red-100 text-red-800",
  amber: "bg-amber-100 text-amber-900",
  green: "bg-green-100 text-green-800",
  stone: "bg-stone-100 text-stone-700",
  blue: "bg-sky-100 text-sky-800",
} as const;

export function Badge({ tone = "stone", children }: { tone?: keyof typeof BADGE; children: React.ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[tone]}`}>{children}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-stone-600">{children}</p>;
}

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1 text-sm ${className}`}>
      <span className="font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}

export function FileLink({ projectId, documentId, children }: { projectId: string; documentId: string | null; children?: React.ReactNode }) {
  if (!documentId) return null;
  return (
    <a href={`/dashboard/projects/${projectId}/files/${documentId}`} target="_blank" rel="noopener" className="text-sm text-amber-700 underline">
      {children ?? "View file"}
    </a>
  );
}

export function ViewerNote({ canEdit }: { canEdit: boolean }) {
  if (canEdit) return null;
  return <p className="rounded-md bg-stone-100 px-3 py-2 text-sm text-stone-700">You can view this project but not change it.</p>;
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-amber-700 underline">
      {children}
    </Link>
  );
}
