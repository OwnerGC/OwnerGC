// Database reads shared by several pages. They run as the signed-in user, so
// row-level security limits them to projects that user belongs to.
import type { SupabaseClient } from "@supabase/supabase-js";
import { summarizeBudget, type BudgetLineRow, type ChangeOrderRow, type ExpenseRow, type LienWaiverRow } from "./budget";

export const LINE_COLUMNS = "id, key, division, name, budget_cents, is_diy, sort_order";
export const EXPENSE_COLUMNS = "id, budget_line_id, spent_on, vendor, amount_cents, waiver_required, document_id, note";

export async function loadBudget(supabase: SupabaseClient, projectId: string) {
  const [lines, expenses, changeOrders, waivers] = await Promise.all([
    supabase.from("budget_lines").select(LINE_COLUMNS).eq("project_id", projectId).order("sort_order"),
    supabase.from("expenses").select(EXPENSE_COLUMNS).eq("project_id", projectId).order("spent_on", { ascending: false }),
    supabase.from("change_orders").select("id, budget_line_id, amount_cents, status").eq("project_id", projectId),
    supabase.from("lien_waivers").select("id, expense_id, status, waiver_type, document_id").eq("project_id", projectId),
  ]);
  const lineRows = (lines.data ?? []) as BudgetLineRow[];
  const expenseRows = (expenses.data ?? []) as (ExpenseRow & { note: string | null })[];
  const coRows = (changeOrders.data ?? []) as ChangeOrderRow[];
  return {
    lines: lineRows,
    expenses: expenseRows,
    changeOrders: coRows,
    waivers: (waivers.data ?? []) as LienWaiverRow[],
    summary: summarizeBudget(lineRows, expenseRows, coRows),
  };
}
