// Phase 4 security tests: budget lines, expenses, change orders, lien waivers,
// documents and the files in storage. Bob (another customer) must never be able
// to see, change or point at anything in Alice's project, a viewer can only
// read, and the file bucket must stay private.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, createSignedInUser, deleteUser, type TestUser } from "./helpers";

let alice: TestUser;
let bob: TestUser;
let vera: TestUser; // a viewer on Alice's project
let aliceProject: string;
let bobProject: string;
const ids: Record<string, string> = {};

const BUCKET = "project-files";
const pdf = () => new Blob(["%PDF-1.4 test file"], { type: "application/pdf" });

async function insert(user: TestUser, table: string, row: Record<string, unknown>) {
  const { data, error } = await user.client.from(table).insert(row).select("id").single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.id as string;
}

beforeAll(async () => {
  alice = await createSignedInUser("alice-p4");
  bob = await createSignedInUser("bob-p4");
  vera = await createSignedInUser("vera-p4");

  aliceProject = await insert(alice, "projects", { name: "Alice's build" });
  bobProject = await insert(bob, "projects", { name: "Bob's build" });
  const { error } = await alice.client.from("project_members").insert({ project_id: aliceProject, user_id: vera.id, role: "viewer" });
  if (error) throw error;

  ids.line = await insert(alice, "budget_lines", { project_id: aliceProject, key: "found", name: "Foundation", budget_cents: 5_000_000 });
  ids.document = await insert(alice, "documents", {
    project_id: aliceProject,
    folder: "receipts",
    title: "Concrete receipt",
    content_type: "application/pdf",
    size_bytes: 18,
    uploaded_by: alice.id,
  });
  const up = await alice.client.storage.from(BUCKET).upload(`projects/${aliceProject}/${ids.document}`, pdf(), { contentType: "application/pdf" });
  if (up.error) throw up.error;
  ids.expense = await insert(alice, "expenses", {
    project_id: aliceProject,
    budget_line_id: ids.line,
    vendor: "Ready Mix Co",
    amount_cents: 1_250_000,
    document_id: ids.document,
  });
  ids.change_order = await insert(alice, "change_orders", {
    project_id: aliceProject,
    number: 1,
    budget_line_id: ids.line,
    title: "Extra rebar",
    amount_cents: 80_000,
  });
  ids.lien_waiver = await insert(alice, "lien_waivers", { project_id: aliceProject, expense_id: ids.expense, status: "received" });
});

afterAll(async () => {
  await alice?.client.storage.from(BUCKET).remove([`projects/${aliceProject}/${ids.document}`]);
  await deleteUser(alice);
  await deleteUser(bob);
  await deleteUser(vera);
});

const TABLES = {
  budget_lines: "line",
  documents: "document",
  expenses: "expense",
  change_orders: "change_order",
  lien_waivers: "lien_waiver",
} as const;

describe("Alice, the owner", () => {
  it("can read everything in her project", async () => {
    for (const [table, key] of Object.entries(TABLES)) {
      const { data } = await alice.client.from(table).select("id").eq("id", ids[key]);
      expect(data, table).toHaveLength(1);
    }
  });

  it("gets a storage path chosen by the database", async () => {
    const { data } = await alice.client.from("documents").select("storage_path").eq("id", ids.document).single();
    expect(data!.storage_path).toBe(`projects/${aliceProject}/${ids.document}`);
  });

  it("can download her file through a short-lived signed link", async () => {
    const { data, error } = await alice.client.storage.from(BUCKET).createSignedUrl(`projects/${aliceProject}/${ids.document}`, 60);
    expect(error).toBeNull();
    const res = await fetch(data!.signedUrl);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("%PDF");
  });
});

describe("Bob cannot get at Alice's spending or documents", () => {
  it("cannot read any of the rows", async () => {
    for (const table of Object.keys(TABLES)) {
      const { data } = await bob.client.from(table).select("*").eq("project_id", aliceProject);
      expect(data ?? [], table).toEqual([]);
    }
  });

  it("cannot add rows to her project", async () => {
    const attempts: [string, Record<string, unknown>][] = [
      ["budget_lines", { project_id: aliceProject, name: "Bogus", budget_cents: 1 }],
      ["documents", { project_id: aliceProject, title: "x", content_type: "application/pdf", size_bytes: 1, uploaded_by: bob.id }],
      ["expenses", { project_id: aliceProject, vendor: "x", amount_cents: 1 }],
      ["change_orders", { project_id: aliceProject, number: 99, budget_line_id: ids.line, title: "x", amount_cents: 1 }],
      ["lien_waivers", { project_id: aliceProject, expense_id: ids.expense }],
    ];
    for (const [table, row] of attempts) {
      const { error } = await bob.client.from(table).insert(row);
      expect(error, table).not.toBeNull();
    }
  });

  it("cannot change or delete her rows", async () => {
    await bob.client.from("budget_lines").update({ budget_cents: 1 }).eq("id", ids.line);
    await bob.client.from("expenses").update({ amount_cents: 1 }).eq("id", ids.expense);
    await bob.client.from("change_orders").update({ status: "approved" }).eq("id", ids.change_order);
    await bob.client.from("documents").update({ title: "hacked" }).eq("id", ids.document);
    await bob.client.from("lien_waivers").update({ status: "requested" }).eq("id", ids.lien_waiver);
    for (const [table, key] of Object.entries(TABLES)) await bob.client.from(table).delete().eq("id", ids[key]);
    await expectAliceUnchanged();
  });

  it("cannot point rows in his own project at her budget line, receipt or payment", async () => {
    const attempts: [string, Record<string, unknown>][] = [
      ["expenses", { project_id: bobProject, vendor: "x", amount_cents: 1, budget_line_id: ids.line }],
      ["expenses", { project_id: bobProject, vendor: "x", amount_cents: 1, document_id: ids.document }],
      ["change_orders", { project_id: bobProject, number: 1, budget_line_id: ids.line, title: "x", amount_cents: 1 }],
      ["lien_waivers", { project_id: bobProject, expense_id: ids.expense }],
      ["documents", { project_id: bobProject, title: "x", content_type: "application/pdf", size_bytes: 1, uploaded_by: bob.id, budget_line_id: ids.line }],
    ];
    for (const [table, row] of attempts) {
      const { error } = await bob.client.from(table).insert(row);
      expect(error, `${table} ${JSON.stringify(row)}`).not.toBeNull();
    }
  });

  it("cannot move his own rows into her project", async () => {
    const line = await insert(bob, "budget_lines", { project_id: bobProject, name: "Bob line", budget_cents: 1 });
    const { error } = await bob.client.from("budget_lines").update({ project_id: aliceProject }).eq("id", line);
    expect(error).not.toBeNull();
  });

  it("cannot download her file, even with the exact path", async () => {
    const path = `projects/${aliceProject}/${ids.document}`;
    const { data } = await bob.client.storage.from(BUCKET).download(path);
    expect(data).toBeNull();
    const { data: signed } = await bob.client.storage.from(BUCKET).createSignedUrl(path, 60);
    expect(signed).toBeNull();
    const { data: listed } = await bob.client.storage.from(BUCKET).list(`projects/${aliceProject}`);
    expect(listed ?? []).toEqual([]);
  });

  it("cannot overwrite, add to or delete her files", async () => {
    const path = `projects/${aliceProject}/${ids.document}`;
    const over = await bob.client.storage.from(BUCKET).upload(path, new Blob(["evil"], { type: "application/pdf" }), { upsert: true });
    expect(over.error).not.toBeNull();
    const extra = await bob.client.storage
      .from(BUCKET)
      .upload(`projects/${aliceProject}/${crypto.randomUUID()}`, pdf(), { contentType: "application/pdf" });
    expect(extra.error).not.toBeNull();
    await bob.client.storage.from(BUCKET).remove([path]);
    const { data } = await alice.client.storage.from(BUCKET).download(path);
    expect(await data!.text()).toContain("%PDF");
  });

  it("cannot claim to be someone else when uploading", async () => {
    const { error } = await bob.client
      .from("documents")
      .insert({ project_id: bobProject, title: "x", content_type: "application/pdf", size_bytes: 1, uploaded_by: alice.id });
    expect(error).not.toBeNull();
  });
});

describe("Vera, a viewer on Alice's project", () => {
  it("can read the spending and download files", async () => {
    const { data } = await vera.client.from("expenses").select("id").eq("project_id", aliceProject);
    expect(data).toHaveLength(1);
    const { data: file } = await vera.client.storage.from(BUCKET).download(`projects/${aliceProject}/${ids.document}`);
    expect(file).not.toBeNull();
  });

  it("cannot add, change or delete anything", async () => {
    const { error } = await vera.client.from("expenses").insert({ project_id: aliceProject, vendor: "x", amount_cents: 1 });
    expect(error).not.toBeNull();
    await vera.client.from("budget_lines").update({ budget_cents: 1 }).eq("id", ids.line);
    for (const [table, key] of Object.entries(TABLES)) await vera.client.from(table).delete().eq("id", ids[key]);
    await vera.client.storage.from(BUCKET).remove([`projects/${aliceProject}/${ids.document}`]);
    await expectAliceUnchanged();
  });
});

describe("the file bucket", () => {
  it("is private: signed-out visitors get nothing", async () => {
    const anon = anonClient();
    const { data } = await anon.storage.from(BUCKET).download(`projects/${aliceProject}/${ids.document}`);
    expect(data).toBeNull();
    const res = await fetch(`${process.env.TEST_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/projects/${aliceProject}/${ids.document}`);
    expect(res.ok).toBe(false);
    for (const table of Object.keys(TABLES)) {
      const { data: rows } = await anon.from(table).select("*");
      expect(rows ?? [], table).toEqual([]);
    }
  });

  it("only takes files that have a document row", async () => {
    const { error } = await bob.client.storage
      .from(BUCKET)
      .upload(`projects/${bobProject}/${crypto.randomUUID()}`, pdf(), { contentType: "application/pdf" });
    expect(error).not.toBeNull();
  });

  it("refuses file types other than PDF, JPEG, PNG and HEIC", async () => {
    const doc = await insert(bob, "documents", {
      project_id: bobProject,
      title: "script",
      content_type: "application/pdf",
      size_bytes: 10,
      uploaded_by: bob.id,
    });
    const { error } = await bob.client.storage
      .from(BUCKET)
      .upload(`projects/${bobProject}/${doc}`, new Blob(["<script>"], { type: "text/html" }), { contentType: "text/html" });
    expect(error).not.toBeNull();
    // ...while the same upload as a real PDF is fine.
    const ok = await bob.client.storage.from(BUCKET).upload(`projects/${bobProject}/${doc}`, pdf(), { contentType: "application/pdf" });
    expect(ok.error).toBeNull();
    await bob.client.storage.from(BUCKET).remove([`projects/${bobProject}/${doc}`]);

    const { error: rowError } = await bob.client
      .from("documents")
      .insert({ project_id: bobProject, title: "x", content_type: "text/html", size_bytes: 1, uploaded_by: bob.id });
    expect(rowError).not.toBeNull();
  });

  it("refuses document rows over 25 MB", async () => {
    const { error } = await bob.client
      .from("documents")
      .insert({ project_id: bobProject, title: "x", content_type: "application/pdf", size_bytes: 26 * 1024 * 1024, uploaded_by: bob.id });
    expect(error).not.toBeNull();
  });
});

async function expectAliceUnchanged() {
  const c = alice.client;
  expect((await c.from("budget_lines").select("budget_cents").eq("id", ids.line).single()).data).toEqual({ budget_cents: 5_000_000 });
  expect((await c.from("expenses").select("amount_cents").eq("id", ids.expense).single()).data).toEqual({ amount_cents: 1_250_000 });
  expect((await c.from("change_orders").select("status").eq("id", ids.change_order).single()).data).toEqual({ status: "proposed" });
  expect((await c.from("documents").select("title").eq("id", ids.document).single()).data).toEqual({ title: "Concrete receipt" });
  expect((await c.from("lien_waivers").select("status").eq("id", ids.lien_waiver).single()).data).toEqual({ status: "received" });
  const { data } = await c.storage.from(BUCKET).download(`projects/${aliceProject}/${ids.document}`);
  expect(await data!.text()).toContain("%PDF");
}
