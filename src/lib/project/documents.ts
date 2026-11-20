// Document folders and upload rules. The same limits are enforced by the
// storage bucket and the documents table, so these are for friendly messages;
// the real gatekeeper is the server.
import { PHASES } from "@/lib/estimator";

export const FOLDERS = {
  plans: "Plans",
  permits: "Permits",
  contracts: "Contracts",
  bids: "Bids",
  receipts: "Receipts",
  lien_waivers: "Lien waivers",
  change_orders: "Change orders",
  inspections: "Inspection reports",
  insurance: "Insurance & licenses",
  photos: "Photos",
  other: "Other",
} as const;

export type Folder = keyof typeof FOLDERS;

export function isFolder(v: unknown): v is Folder {
  return typeof v === "string" && Object.hasOwn(FOLDERS, v);
}

export const PHASE_NAMES: Record<string, string> = Object.fromEntries(PHASES.map((p) => [p.key, p.name]));

export function isPhaseKey(v: unknown): v is string {
  return typeof v === "string" && Object.hasOwn(PHASE_NAMES, v);
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"] as const;
export type AllowedType = (typeof ALLOWED_TYPES)[number];

const BY_EXTENSION: Record<string, AllowedType> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
};

/** Accept attribute for <input type="file">. */
export const ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,image/jpeg,image/png,image/heic,image/heif";

/**
 * The content type to store for a file, or an error message. Phones often send
 * HEIC photos with no type at all, so fall back to the file extension.
 */
export function checkUpload(file: { name: string; type: string; size: number }):
  | { ok: true; contentType: AllowedType }
  | { ok: false; error: string } {
  if (file.size <= 0) return { ok: false, error: "That file is empty." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "Files can be up to 25 MB." };
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const type = (ALLOWED_TYPES as readonly string[]).includes(file.type) ? (file.type as AllowedType) : BY_EXTENSION[ext];
  if (!type) return { ok: false, error: "Upload a PDF, JPEG, PNG or HEIC file." };
  return { ok: true, contentType: type };
}

/** "Receipt 2026-11-20.jpg" -> "Receipt 2026-11-20" */
export function titleFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, "").trim().slice(0, 200) || "Untitled";
}

/** Escape % and _ so a search box can't turn into a wildcard pattern. */
export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
