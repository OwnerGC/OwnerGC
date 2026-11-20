// Download every payment as a CSV file (opens in Excel or Google Sheets).
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadBudget } from "@/lib/project/load";
import { waiverState } from "@/lib/project/budget";
import { toCsv } from "@/lib/project/csv";
import { isUuid } from "@/lib/project/validate";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return new NextResponse("Not found", { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: project } = await supabase.from("projects").select("name").eq("id", id).maybeSingle();
  if (!project) return new NextResponse("Not found", { status: 404 });

  const { lines, expenses, waivers } = await loadBudget(supabase, id);
  const lineById = new Map(lines.map((l) => [l.id, l]));
  const rows = [...expenses]
    .sort((a, b) => a.spent_on.localeCompare(b.spent_on))
    .map((e) => {
      const line = e.budget_line_id ? lineById.get(e.budget_line_id) : undefined;
      return [e.spent_on, e.vendor, (e.amount_cents / 100).toFixed(2), line?.division ?? "", line?.name ?? "", e.note ?? "", e.document_id ? "yes" : "no", waiverState(e, waivers).replace("_", " ")];
    });
  const csv = toCsv([["Date", "Paid to", "Amount", "Division", "Budget line", "Note", "Receipt", "Lien waiver"], ...rows]);
  const name = project.name.replace(/[^\w -]+/g, "").trim() || "project";
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name} spending.csv"`,
    },
  });
}
