# OwnerBuilder

Web app for owner-builders running their own custom home build. See `BRIEF.md` (the project brief) for the full plan.

**Status: phase 2 (free estimator).** The public home page and free cost estimator (`/`, `/estimate`), saving an estimate as a project, and the phase 1 foundation: sign-up and login, projects with row-level security, and tests proving one user can't see another user's project.

## How it fits together

| Piece | What it does | Where it lives |
| --- | --- | --- |
| Public pages | Home page, free estimator, privacy policy (same design as ownergc.app) | `src/app/(marketing)/` |
| Signed-in app | Login, your projects, a saved project's estimate | `src/app/(app)/` |
| Cost model | The estimator's math and reference numbers (cost shares, DIY savings, phases, draws). Change numbers in `data.ts` | `src/lib/estimator/` |
| Supabase clients | How the app talks to the database as the signed-in user | `src/lib/supabase/` |
| Middleware | Keeps you logged in and sends signed-out visitors to `/login` | `src/middleware.ts` |
| Database schema and security rules | Tables plus the rules that wall each customer's data off | `supabase/migrations/` |
| Security tests | Sign in as two users and try to break in to each other's data | `tests/` |
| Supabase local settings | Local copy of Supabase, including "confirm your email" being on | `supabase/config.toml` |

### The security model, in one paragraph

Every project has a list of members (`project_members`), each with a role: owner, editor or viewer. The database itself, not the website, checks that list on every read and write: you can see a project only if you're on its list, edit it only as owner or editor, and delete it or add people only as owner. When you create a project you're added as its owner automatically. Signed-out visitors can't read anything. Because the database enforces this, a bug in the website can't leak one customer's data to another. Every future table (budget lines, expenses, documents...) will use the same check.

## Running it on your computer

You need [Node.js 22](https://nodejs.org) and [Docker Desktop](https://www.docker.com/products/docker-desktop/) (free for personal use) installed and running.

```bash
npm install                 # download the app's building blocks
npx supabase start          # start a private copy of Supabase in Docker (first run downloads ~2 GB)
npx supabase status         # prints the local URL and "anon key"
cp .env.example .env.local  # then paste the anon key into .env.local
npm run dev                 # open http://localhost:3000
```

Sign-up emails don't really get sent locally. Open the local mailbox at http://127.0.0.1:54324 to click the confirmation link.

## Running the tests

```bash
npm run test:unit      # the cost model; no database needed, takes a second
npm test               # everything, including the security tests (needs local Supabase running)
```

The unit tests also run the original ownergc.app landing page script and check the app gives exactly the same numbers. The security tests refuse to run against anything except the local database, so they can never touch real customer data. They also run automatically on GitHub for every change (`.github/workflows/security-tests.yml`).

## Turning on Google sign-in

The "Continue with Google" button is wired up but needs Google credentials (free):

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth client ID** of type "Web application".
2. Add the authorized redirect URI from Supabase: `http://127.0.0.1:54321/auth/v1/callback` for local, and `https://<your-project>.supabase.co/auth/v1/callback` for the real one.
3. **Local:** put the client ID and secret in `.env.local` as `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`, set `enabled = true` under `[auth.external.google]` in `supabase/config.toml`, and restart with `npx supabase stop && npx supabase start`.
4. **Hosted:** paste them into the Supabase dashboard under Authentication > Providers > Google.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the site locally with live reload |
| `npm test` | Run the security tests |
| `npm run typecheck` | Check the TypeScript for mistakes |
| `npm run lint` | Check code style |
| `npm run build` | Build the production version (what Vercel runs) |
| `npx supabase stop` | Stop local Supabase |
| `npx supabase db reset` | Wipe the local database and rebuild it from `supabase/migrations/` |
