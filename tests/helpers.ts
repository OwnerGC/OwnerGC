import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = () => process.env.TEST_SUPABASE_URL!;
const anonKey = () => process.env.TEST_SUPABASE_ANON_KEY!;

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Full-power client. Only used by the tests to create and clean up users. */
export function adminClient() {
  return createClient(url(), process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!, noSession);
}

/** A client with no one signed in, like a stranger visiting the site. */
export function anonClient() {
  return createClient(url(), anonKey(), noSession);
}

export type TestUser = { id: string; email: string; client: SupabaseClient };

/** Create a confirmed user and return a client signed in as them. */
export async function createSignedInUser(label: string): Promise<TestUser> {
  const email = `${label}-${randomUUID()}@test.ownerbuilder.local`;
  const password = `pw-${randomUUID()}`;

  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Test ${label}` },
  });
  if (error) throw error;

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  return { id: data.user.id, email, client };
}

export async function deleteUser(user: TestUser | undefined) {
  if (user) await adminClient().auth.admin.deleteUser(user.id);
}
