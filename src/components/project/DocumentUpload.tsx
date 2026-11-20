"use client";
// Upload one or more files into the project's documents, with a folder, the
// build phase they belong to and (for insurance) an expiry date.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ACCEPT, FOLDERS, PHASE_NAMES, type Folder } from "@/lib/project/documents";
import { uploadDocument } from "./upload";
import { Field, buttonClass, inputClass } from "./ui";

export function DocumentUpload({
  projectId,
  defaultFolder = "other",
  defaultPhase = "",
  lockFolder = false,
}: {
  projectId: string;
  defaultFolder?: Folder;
  defaultPhase?: string;
  lockFolder?: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [folder, setFolder] = useState<Folder>(defaultFolder);

  async function submit(fd: FormData) {
    const files = fd.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) {
      setErrors(["Choose at least one file."]);
      return;
    }
    const errs: string[] = [];
    for (const [i, file] of files.entries()) {
      setProgress(`Uploading ${i + 1} of ${files.length}…`);
      const res = await uploadDocument({
        projectId,
        file,
        folder: (fd.get("folder") as Folder) ?? defaultFolder,
        title: files.length === 1 ? String(fd.get("title") ?? "") : "",
        phase: String(fd.get("phase") ?? ""),
        notes: String(fd.get("notes") ?? ""),
        expiresOn: String(fd.get("expires_on") ?? ""),
      });
      if ("error" in res) errs.push(`${file.name}: ${res.error}`);
    }
    setProgress(null);
    setErrors(errs);
    if (!errs.length) ref.current?.reset();
    router.refresh();
  }

  return (
    <form
      ref={ref}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(() => submit(fd));
      }}
      className="grid gap-3 p-4 sm:grid-cols-2"
    >
      <fieldset disabled={pending} className="contents">
        <Field label="Files (PDF, JPEG, PNG or HEIC, up to 25 MB each)" className="sm:col-span-2">
          <input name="file" type="file" multiple accept={ACCEPT} required className="block w-full text-sm" />
        </Field>
        <Field label="Title (optional, uses the file name)">
          <input name="title" className={inputClass} />
        </Field>
        <Field label="Folder">
          {lockFolder ? (
            <>
              <input type="hidden" name="folder" value={defaultFolder} />
              <input value={FOLDERS[defaultFolder]} disabled className={inputClass} />
            </>
          ) : (
            <select name="folder" value={folder} onChange={(e) => setFolder(e.target.value as Folder)} className={inputClass}>
              {Object.entries(FOLDERS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Build phase">
          <select name="phase" defaultValue={defaultPhase} className={inputClass}>
            <option value="">Whole project</option>
            {Object.entries(PHASE_NAMES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        {folder === "insurance" ? (
          <Field label="Expires on">
            <input name="expires_on" type="date" className={inputClass} />
          </Field>
        ) : (
          <Field label="Notes">
            <input name="notes" className={inputClass} />
          </Field>
        )}
        <div className="sm:col-span-2">
          <button className={buttonClass}>{pending ? (progress ?? "Uploading…") : "Upload"}</button>
        </div>
      </fieldset>
      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 sm:col-span-2">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
