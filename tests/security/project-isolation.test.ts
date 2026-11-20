// Security tests: prove that one customer can never see or change another
// customer's project. Each test signs in as a real user against the local
// Supabase and tries to get at the other user's data through the public API,
// exactly as a malicious browser could.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, createSignedInUser, deleteUser, type TestUser } from "./helpers";

let alice: TestUser;
let bob: TestUser;
let aliceProjectId: string;

beforeAll(async () => {
  alice = await createSignedInUser("alice");
  bob = await createSignedInUser("bob");

  const { data, error } = await alice.client
    .from("projects")
    .insert({ name: "Alice's lake house", address: "1 Private Rd", inputs: { sqft: 2400 } })
    .select("id")
    .single();
  if (error) throw error;
  aliceProjectId = data.id;
});

afterAll(async () => {
  await deleteUser(alice);
  await deleteUser(bob);
});

describe("the project owner", () => {
  it("can read their own project", async () => {
    const { data, error } = await alice.client.from("projects").select("*").eq("id", aliceProjectId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].owner_id).toBe(alice.id);
  });

  it("is automatically the project's owner member", async () => {
    const { data } = await alice.client
      .from("project_members")
      .select("user_id, role")
      .eq("project_id", aliceProjectId);
    expect(data).toEqual([{ user_id: alice.id, role: "owner" }]);
  });

  it("got a profile created at sign-up", async () => {
    const { data } = await alice.client.from("profiles").select("id, name").eq("id", alice.id).single();
    expect(data).toEqual({ id: alice.id, name: "Test alice" });
  });
});

describe("another signed-in user (Bob) cannot get at Alice's project", () => {
  it("cannot read it by id", async () => {
    const { data, error } = await bob.client.from("projects").select("*").eq("id", aliceProjectId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("does not see it when listing all projects", async () => {
    const { data } = await bob.client.from("projects").select("id");
    expect(data!.map((p) => p.id)).not.toContain(aliceProjectId);
  });

  it("cannot see who is on it", async () => {
    const { data } = await bob.client.from("project_members").select("*").eq("project_id", aliceProjectId);
    expect(data).toEqual([]);
  });

  it("cannot read Alice's profile", async () => {
    const { data } = await bob.client.from("profiles").select("*").eq("id", alice.id);
    expect(data).toEqual([]);
  });

  it("cannot rename it", async () => {
    const { data } = await bob.client
      .from("projects")
      .update({ name: "hacked" })
      .eq("id", aliceProjectId)
      .select();
    expect(data ?? []).toEqual([]);
    await expectAliceProjectUnchanged();
  });

  it("cannot delete it", async () => {
    await bob.client.from("projects").delete().eq("id", aliceProjectId);
    await expectAliceProjectUnchanged();
  });

  it("cannot add himself as a member", async () => {
    for (const role of ["owner", "editor", "viewer"]) {
      const { error } = await bob.client
        .from("project_members")
        .insert({ project_id: aliceProjectId, user_id: bob.id, role });
      expect(error, `inserting role ${role}`).not.toBeNull();
    }
    const { data } = await bob.client.from("projects").select("id").eq("id", aliceProjectId);
    expect(data).toEqual([]);
  });

  it("cannot create a project in Alice's name", async () => {
    const { error } = await bob.client.from("projects").insert({ name: "Fake", owner_id: alice.id });
    expect(error).not.toBeNull();
  });

  it("cannot rename Alice's profile", async () => {
    await bob.client.from("profiles").update({ name: "hacked" }).eq("id", alice.id);
    const { data } = await alice.client.from("profiles").select("name").eq("id", alice.id).single();
    expect(data!.name).toBe("Test alice");
  });
});

describe("a signed-out visitor", () => {
  it("cannot read any projects, members or profiles", async () => {
    const anon = anonClient();
    for (const table of ["projects", "project_members", "profiles"]) {
      const { data } = await anon.from(table).select("*");
      expect(data ?? [], table).toEqual([]);
    }
  });

  it("cannot create a project", async () => {
    const { error } = await anonClient().from("projects").insert({ name: "spam" });
    expect(error).not.toBeNull();
  });
});

describe("owners cannot be tricked out of their project", () => {
  it("an owner cannot hand ownership to someone else by editing owner_id", async () => {
    const { error } = await alice.client.from("projects").update({ owner_id: bob.id }).eq("id", aliceProjectId);
    expect(error).not.toBeNull();
    await expectAliceProjectUnchanged();
  });
});

describe("sharing works only when the owner chooses it", () => {
  it("a viewer Alice invites can read but not edit, and loses access when removed", async () => {
    const { error: addError } = await alice.client
      .from("project_members")
      .insert({ project_id: aliceProjectId, user_id: bob.id, role: "viewer" });
    expect(addError).toBeNull();

    const { data: seen } = await bob.client.from("projects").select("id").eq("id", aliceProjectId);
    expect(seen).toHaveLength(1);

    const { data: updated } = await bob.client
      .from("projects")
      .update({ name: "viewer edit" })
      .eq("id", aliceProjectId)
      .select();
    expect(updated ?? []).toEqual([]);

    // A viewer cannot promote himself.
    await bob.client
      .from("project_members")
      .update({ role: "editor" })
      .eq("project_id", aliceProjectId)
      .eq("user_id", bob.id);
    const { data: role } = await alice.client
      .from("project_members")
      .select("role")
      .eq("project_id", aliceProjectId)
      .eq("user_id", bob.id)
      .single();
    expect(role!.role).toBe("viewer");

    // A viewer cannot remove the owner.
    await bob.client.from("project_members").delete().eq("project_id", aliceProjectId).eq("user_id", alice.id);

    await alice.client.from("project_members").delete().eq("project_id", aliceProjectId).eq("user_id", bob.id);
    const { data: after } = await bob.client.from("projects").select("id").eq("id", aliceProjectId);
    expect(after).toEqual([]);

    await expectAliceProjectUnchanged();
  });
});

async function expectAliceProjectUnchanged() {
  const { data } = await alice.client.from("projects").select("name, owner_id").eq("id", aliceProjectId).single();
  expect(data).toEqual({ name: "Alice's lake house", owner_id: alice.id });
  const { data: owners } = await alice.client
    .from("project_members")
    .select("user_id")
    .eq("project_id", aliceProjectId)
    .eq("role", "owner");
  expect(owners).toEqual([{ user_id: alice.id }]);
}
