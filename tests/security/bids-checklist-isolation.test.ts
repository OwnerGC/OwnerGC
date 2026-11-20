// Phase 5 security tests: subs, bids, checklist tasks, selections and the
// project start date. Same promises as before: Bob can't see, change or point
// at anything of Alice's, viewers only read, and one award per budget line.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, createSignedInUser, deleteUser, type TestUser } from "./helpers";

let alice: TestUser;
let bob: TestUser;
let vera: TestUser;
let aliceProject: string;
let bobProject: string;
const ids: Record<string, string> = {};

async function insert(user: TestUser, table: string, row: Record<string, unknown>) {
  const { data, error } = await user.client.from(table).insert(row).select("id").single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.id as string;
}

beforeAll(async () => {
  alice = await createSignedInUser("alice-p5");
  bob = await createSignedInUser("bob-p5");
  vera = await createSignedInUser("vera-p5");
  aliceProject = await insert(alice, "projects", { name: "Alice's build" });
  bobProject = await insert(bob, "projects", { name: "Bob's build" });
  await alice.client.from("project_members").insert({ project_id: aliceProject, user_id: vera.id, role: "viewer" });

  ids.line = await insert(alice, "budget_lines", { project_id: aliceProject, name: "Plumbing", budget_cents: 3_000_000 });
  ids.sub = await insert(alice, "subs", { project_id: aliceProject, company: "Pipe Pros", trade: "Plumber", phone: "555-0100" });
  ids.bid = await insert(alice, "bids", { project_id: aliceProject, sub_id: ids.sub, budget_line_id: ids.line, amount_cents: 2_800_000 });
  ids.task = await insert(alice, "tasks", { project_id: aliceProject, phase: "found", key: "found.ftg", title: "Footing inspection", is_inspection: true });
  ids.selection = await insert(alice, "selections", { project_id: aliceProject, item: "Kitchen faucet", allowance_cents: 40_000 });
});

afterAll(async () => {
  await deleteUser(alice);
  await deleteUser(bob);
  await deleteUser(vera);
});

const TABLES = { subs: "sub", bids: "bid", tasks: "task", selections: "selection" } as const;

describe("Bob cannot get at Alice's subs, bids, checklist or selections", () => {
  it("cannot read them", async () => {
    for (const table of Object.keys(TABLES)) {
      const { data } = await bob.client.from(table).select("*").eq("project_id", aliceProject);
      expect(data ?? [], table).toEqual([]);
    }
  });

  it("cannot add to her project", async () => {
    const attempts: [string, Record<string, unknown>][] = [
      ["subs", { project_id: aliceProject, company: "x" }],
      ["bids", { project_id: aliceProject, sub_id: ids.sub, budget_line_id: ids.line, amount_cents: 1 }],
      ["tasks", { project_id: aliceProject, phase: "found", title: "x" }],
      ["selections", { project_id: aliceProject, item: "x" }],
    ];
    for (const [table, row] of attempts) expect((await bob.client.from(table).insert(row)).error, table).not.toBeNull();
  });

  it("cannot change or delete her rows, or award her bid", async () => {
    await bob.client.from("subs").update({ phone: "hacked" }).eq("id", ids.sub);
    await bob.client.from("bids").update({ status: "awarded", amount_cents: 1 }).eq("id", ids.bid);
    await bob.client.from("tasks").update({ done_at: "2026-01-01" }).eq("id", ids.task);
    await bob.client.from("selections").update({ actual_cents: 1 }).eq("id", ids.selection);
    await bob.client.from("projects").update({ start_date: "2020-01-01" }).eq("id", aliceProject);
    for (const [table, key] of Object.entries(TABLES)) await bob.client.from(table).delete().eq("id", ids[key]);
    await expectAliceUnchanged();
  });

  it("cannot use her sub or budget line in his own project", async () => {
    const bobLine = await insert(bob, "budget_lines", { project_id: bobProject, name: "Bob line" });
    const bobSub = await insert(bob, "subs", { project_id: bobProject, company: "Bob sub" });
    const attempts: [string, Record<string, unknown>][] = [
      ["bids", { project_id: bobProject, sub_id: ids.sub, budget_line_id: bobLine, amount_cents: 1 }],
      ["bids", { project_id: bobProject, sub_id: bobSub, budget_line_id: ids.line, amount_cents: 1 }],
      ["selections", { project_id: bobProject, item: "x", budget_line_id: ids.line }],
      ["documents", { project_id: bobProject, title: "x", content_type: "application/pdf", size_bytes: 1, uploaded_by: bob.id, sub_id: ids.sub }],
    ];
    for (const [table, row] of attempts) expect((await bob.client.from(table).insert(row)).error, `${table} ${JSON.stringify(row)}`).not.toBeNull();
  });

  it("cannot move his rows into her project", async () => {
    const sub = await insert(bob, "subs", { project_id: bobProject, company: "Mover" });
    expect((await bob.client.from("subs").update({ project_id: aliceProject }).eq("id", sub)).error).not.toBeNull();
  });
});

describe("Vera, a viewer", () => {
  it("can read but not change anything", async () => {
    const { data } = await vera.client.from("bids").select("id").eq("project_id", aliceProject);
    expect(data).toHaveLength(1);
    expect((await vera.client.from("subs").insert({ project_id: aliceProject, company: "x" })).error).not.toBeNull();
    await vera.client.from("tasks").update({ done_at: "2026-01-01" }).eq("id", ids.task);
    await vera.client.from("bids").update({ status: "awarded" }).eq("id", ids.bid);
    for (const [table, key] of Object.entries(TABLES)) await vera.client.from(table).delete().eq("id", ids[key]);
    await expectAliceUnchanged();
  });
});

describe("signed-out visitors", () => {
  it("see nothing", async () => {
    for (const table of Object.keys(TABLES)) {
      const { data } = await anonClient().from(table).select("*");
      expect(data ?? [], table).toEqual([]);
    }
  });
});

describe("awarding", () => {
  it("allows only one awarded bid per budget line", async () => {
    const sub2 = await insert(alice, "subs", { project_id: aliceProject, company: "Second Plumbing" });
    const bid2 = await insert(alice, "bids", { project_id: aliceProject, sub_id: sub2, budget_line_id: ids.line, amount_cents: 2_900_000 });
    expect((await alice.client.from("bids").update({ status: "awarded" }).eq("id", bid2)).error).toBeNull();
    expect((await alice.client.from("bids").update({ status: "awarded" }).eq("id", ids.bid)).error).not.toBeNull();
    await alice.client.from("bids").delete().eq("id", bid2);
    await alice.client.from("subs").delete().eq("id", sub2);
  });

  it("refuses oversized AI review data", async () => {
    const { error } = await alice.client.from("bids").update({ ai_review: { junk: "x".repeat(70_000) } }).eq("id", ids.bid);
    expect(error).not.toBeNull();
  });
});

async function expectAliceUnchanged() {
  const c = alice.client;
  expect((await c.from("subs").select("phone").eq("id", ids.sub).single()).data).toEqual({ phone: "555-0100" });
  expect((await c.from("bids").select("status, amount_cents").eq("id", ids.bid).single()).data).toEqual({ status: "received", amount_cents: 2_800_000 });
  expect((await c.from("tasks").select("done_at").eq("id", ids.task).single()).data).toEqual({ done_at: null });
  expect((await c.from("selections").select("actual_cents").eq("id", ids.selection).single()).data).toEqual({ actual_cents: null });
  expect((await c.from("projects").select("start_date").eq("id", aliceProject).single()).data).toEqual({ start_date: null });
}
