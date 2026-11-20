// Sign-up rules from the brief: new email accounts must confirm their email
// before they can sign in.
import { afterAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { adminClient, anonClient } from "./helpers";

const email = `newcomer-${randomUUID()}@test.ownerbuilder.local`;
const password = `pw-${randomUUID()}`;
let userId: string | undefined;

afterAll(async () => {
  if (userId) await adminClient().auth.admin.deleteUser(userId);
});

describe("email sign-up", () => {
  it("does not sign the user in until they confirm their email", async () => {
    const client = anonClient();
    const { data, error } = await client.auth.signUp({ email, password });
    expect(error).toBeNull();
    userId = data.user?.id;
    expect(data.session).toBeNull();

    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    expect(signInError?.message).toMatch(/not confirmed/i);
  });
});
