// Phase 2: saved estimates live in projects.inputs. The database must refuse
// junk there, and a saved estimate must stay private to its project.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_INPUTS, toStoredInputs } from "@/lib/estimator";
import { createSignedInUser, deleteUser, type TestUser } from "./helpers";

let alice: TestUser;
let bob: TestUser;
let projectId: string;

beforeAll(async () => {
  alice = await createSignedInUser("alice-est");
  bob = await createSignedInUser("bob-est");
  const { data, error } = await alice.client
    .from("projects")
    .insert({ name: "Alice's farmhouse", inputs: toStoredInputs(DEFAULT_INPUTS) })
    .select("id")
    .single();
  if (error) throw error;
  projectId = data.id;
});

afterAll(async () => {
  await deleteUser(alice);
  await deleteUser(bob);
});

describe("saving an estimate", () => {
  it("stores the estimator inputs on the project", async () => {
    const { data } = await alice.client.from("projects").select("inputs").eq("id", projectId).single();
    expect(data!.inputs).toEqual(toStoredInputs(DEFAULT_INPUTS));
  });

  it("lets the owner update the saved estimate", async () => {
    const updated = toStoredInputs({ ...DEFAULT_INPUTS, land: 99000 });
    const { data, error } = await alice.client.from("projects").update({ inputs: updated }).eq("id", projectId).select("inputs");
    expect(error).toBeNull();
    expect(data![0].inputs).toEqual(updated);
  });

  it("refuses inputs that aren't a JSON object", async () => {
    for (const inputs of [[1, 2, 3], "text", 42]) {
      const { error } = await alice.client.from("projects").insert({ name: "Bad", inputs });
      expect(error, JSON.stringify(inputs)).not.toBeNull();
    }
  });

  it("refuses oversized inputs", async () => {
    const { error } = await alice.client.from("projects").insert({ name: "Huge", inputs: { junk: "x".repeat(20_000) } });
    expect(error).not.toBeNull();
  });
});

describe("another user cannot touch Alice's saved estimate", () => {
  it("cannot read it", async () => {
    const { data } = await bob.client.from("projects").select("inputs").eq("id", projectId);
    expect(data).toEqual([]);
  });

  it("cannot overwrite it", async () => {
    const { data } = await bob.client
      .from("projects")
      .update({ inputs: { hacked: true } })
      .eq("id", projectId)
      .select();
    expect(data ?? []).toEqual([]);
    const { data: still } = await alice.client.from("projects").select("inputs").eq("id", projectId).single();
    expect(still!.inputs).not.toHaveProperty("hacked");
  });
});
