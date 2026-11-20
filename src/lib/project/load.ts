// Database reads shared by several pages. They run as the signed-in user, so
// row-level security limits them to projects that user belongs to.
import type { SupabaseClient } from "@supabase/supabase-js";
import { summarizeBudget, type BudgetLineRow, type ChangeOrderRow, type ExpenseRow, type LienWaiverRow } from "./budget";
import type { BidRow, SubRow } from "./bids";
import type { TaskRow } from "./schedule";

export const LINE_COLUMNS = "id, key, division, name, budget_cents, is_diy, sort_order";
export const EXPENSE_COLUMNS = "id, budget_line_id, spent_on, vendor, amount_cents, waiver_required, document_id, note";
export const BID_COLUMNS = "id, sub_id, budget_line_id, amount_cents, status, received_on, due_on, notes, document_id, ai_review, ai_reviewed_at";
export const SUB_COLUMNS = "id, company, contact_name, trade, phone, email, notes, license_number, license_expires_on, insurance_expires_on";
export const TASK_COLUMNS = "id, phase, key, title, is_inspection, due_date, done_at, sort_order";

export async function loadBudget(supabase: SupabaseClient, projectId: string) {
  const [lines, expenses, changeOrders, waivers, bids] = await Promise.all([
    supabase.from("budget_lines").select(LINE_COLUMNS).eq("project_id", projectId).order("sort_order"),
    supabase.from("expenses").select(EXPENSE_COLUMNS).eq("project_id", projectId).order("spent_on", { ascending: false }),
    supabase.from("change_orders").select("id, budget_line_id, amount_cents, status").eq("project_id", projectId),
    supabase.from("lien_waivers").select("id, expense_id, status, waiver_type, document_id").eq("project_id", projectId),
    supabase.from("bids").select("budget_line_id, amount_cents").eq("project_id", projectId).eq("status", "awarded"),
  ]);
  const lineRows = (lines.data ?? []) as BudgetLineRow[];
  const expenseRows = (expenses.data ?? []) as (ExpenseRow & { note: string | null })[];
  const coRows = (changeOrders.data ?? []) as ChangeOrderRow[];
  const awarded = (bids.data ?? []) as { budget_line_id: string; amount_cents: number }[];
  return {
    lines: lineRows,
    expenses: expenseRows,
    changeOrders: coRows,
    waivers: (waivers.data ?? []) as LienWaiverRow[],
    awarded,
    summary: summarizeBudget(lineRows, expenseRows, coRows, awarded),
  };
}

export async function loadSubsAndBids(supabase: SupabaseClient, projectId: string) {
  const [subs, bids] = await Promise.all([
    supabase.from("subs").select(SUB_COLUMNS).eq("project_id", projectId).order("trade").order("company"),
    supabase.from("bids").select(BID_COLUMNS).eq("project_id", projectId).order("created_at"),
  ]);
  return { subs: (subs.data ?? []) as SubRow[], bids: (bids.data ?? []) as BidRow[] };
}

export async function loadTasks(supabase: SupabaseClient, projectId: string) {
  const { data } = await supabase.from("tasks").select(TASK_COLUMNS).eq("project_id", projectId).order("sort_order");
  return (data ?? []) as TaskRow[];
}
