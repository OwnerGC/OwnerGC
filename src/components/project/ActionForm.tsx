"use client";
// A form that runs a server action and shows its error, if any. If the form has
// a file input named "file", the file goes straight from the browser to the
// private storage bucket first (big phone photos never pass through our
// server), and the action receives the new document's id as "document_id".
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadDocument } from "./upload";
import type { Folder } from "@/lib/project/documents";

type Result = { error?: string; ok?: boolean } | void;

export function ActionForm({
  action,
  projectId,
  upload,
  className,
  children,
  resetOnSuccess = true,
  confirm: confirmText,
}: {
  action: (formData: FormData) => Promise<Result>;
  projectId: string;
  /** Where an attached file goes, and which form field holds its title. */
  upload?: { folder: Folder; titleField?: string; phaseField?: string; lineField?: string; subField?: string; expiresField?: string };
  className?: string;
  children: React.ReactNode;
  resetOnSuccess?: boolean;
  confirm?: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  async function submit(formData: FormData) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    formData.set("project_id", projectId);
    const file = formData.get("file");
    formData.delete("file");
    if (upload && file instanceof File && file.size > 0) {
      setStatus("Uploading…");
      const res = await uploadDocument({
        projectId,
        file,
        folder: (formData.get("folder") as Folder) || upload.folder,
        title: upload.titleField ? String(formData.get(upload.titleField) ?? "") : "",
        phase: upload.phaseField ? String(formData.get(upload.phaseField) ?? "") : "",
        budgetLineId: upload.lineField ? String(formData.get(upload.lineField) ?? "") : "",
        subId: upload.subField ? String(formData.get(upload.subField) ?? "") : "",
        expiresOn: upload.expiresField ? String(formData.get(upload.expiresField) ?? "") : "",
      });
      if ("error" in res) {
        setStatus(null);
        setError(res.error);
        return;
      }
      formData.set("document_id", res.id);
    }
    setStatus("Saving…");
    const result = await action(formData);
    setStatus(null);
    if (result && result.error) {
      setError(result.error);
      return;
    }
    if (resetOnSuccess) ref.current?.reset();
    router.refresh();
  }

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(() => submit(fd));
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {status && pending && <p className="text-sm text-stone-600">{status}</p>}
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
    </form>
  );
}
