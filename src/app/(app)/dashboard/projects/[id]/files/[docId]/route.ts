// Opens an uploaded file. The bucket is private, so this asks storage for a
// signed link that expires in 60 seconds and sends the browser there. Storage
// only signs it if the signed-in person is a member of the project.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/project/validate";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  if (!isUuid(id) || !isUuid(docId)) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path, title, content_type")
    .eq("id", docId)
    .eq("project_id", id)
    .maybeSingle();
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const download = request.nextUrl.searchParams.has("download") ? safeFilename(doc.title, doc.content_type) : undefined;
  const { data, error } = await supabase.storage.from("project-files").createSignedUrl(doc.storage_path, 60, { download });
  if (error || !data) return new NextResponse("File not found", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}

function safeFilename(title: string, type: string) {
  const ext = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic", "image/heif": "heif" }[type] ?? "bin";
  return `${title.replace(/[^\w .-]+/g, "_").slice(0, 100)}.${ext}`;
}
