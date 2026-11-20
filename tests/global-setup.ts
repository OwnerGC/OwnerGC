// Before any test runs: find the local Supabase started by `npx supabase start`
// and hand its address and keys to the tests. Refuses to run against anything
// that isn't on this computer, so tests can never touch real customer data.
import { execSync } from "node:child_process";

export default function setup() {
  let status: Record<string, string>;
  try {
    status = JSON.parse(execSync("npx supabase status -o json", { stdio: ["ignore", "pipe", "ignore"] }).toString());
  } catch {
    throw new Error("Local Supabase is not running. Start it with: npx supabase start");
  }

  const url = new URL(status.API_URL);
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error(`Refusing to run security tests against a non-local database: ${status.API_URL}`);
  }

  process.env.TEST_SUPABASE_URL = status.API_URL;
  process.env.TEST_SUPABASE_ANON_KEY = status.ANON_KEY;
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;
  process.env.TEST_MAILPIT_URL = status.MAILPIT_URL ?? status.INBUCKET_URL;
}
