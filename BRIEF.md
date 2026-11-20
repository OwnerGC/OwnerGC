# OwnerBuilder Project Brief

Nov 20, 2026 · @Jake Stevens

## Overview

OwnerBuilder is a web app, later a phone app, that runs a custom house build for people acting as their own general contractor. It covers the whole job from first estimate to certificate of occupancy: budget, bids, spending, inspections, loan draws and every document.

- **Who it's for:** owner-builders spending $400k to $1M+ on a custom home, usually with a construction loan. A secondary market is small builders, flippers and investors running several builds a year.
- **Why they pay:** they're managing a project they've never run, with a lender watching every dollar. One missed inspection, sub overbilling or blown budget line costs far more than the subscription.
- **Business model:** a free estimator brings people in. Paid tiers unlock the tracking tools for the length of the build.

| Tier | Price | Includes |
| --- | --- | --- |
| Free | $0 | Budget estimator, DIY savings, build schedule |
| Build | $24/month | One project: spending, bids, checklist, draws, document storage |
| Pro | $59/month | Unlimited projects, for builders, flippers and investors |

A working single-page prototype already exists as a Claude artifact. It proves the screens and calculations; this brief turns it into a production app with real accounts, payments and storage.

## Recommended stack

Use Supabase for the database, logins and file storage, Vercel for hosting, and Stripe for subscriptions. That is three accounts to set up, about $45/month fixed at launch, and two paying customers cover it.

| Need | Pick | Why | Cost at launch |
| --- | --- | --- | --- |
| Database | [Supabase](https://supabase.com/pricing) (Postgres) | Real relational database; row-level security keeps each customer's data walled off at the database itself | Pro plan $25/month: 8 GB database, daily backups kept 7 days, never pauses |
| Logins | Supabase Auth | Email, Google and Apple sign-in, password resets and MFA built in, tied to the same security rules | Included: 100,000 monthly active users |
| File storage | Supabase Storage (private bucket) | Same rules and account as the data; files served by short-lived signed links | Included: 100 GB, then $0.0213/GB |
| Hosting | [Vercel](https://vercel.com/docs/plans/pro-plan) Pro | Push code to GitHub and it deploys; free preview link for every change | $20/month, includes $20 usage credit and a free first-year domain |
| Payments | [Stripe](https://stripe.com/billing/pricing) Checkout + Billing | Hosted checkout and customer billing portal; you never touch card numbers | 2.9% + 30¢ per charge plus 0.7% Billing, about $1.17 on a $24 subscription |
| App framework | Next.js + TypeScript + Tailwind | What Claude Code builds most reliably; one codebase for web and the later phone app | Free |

**Why not the free tiers:** Supabase Free pauses projects after a week of inactivity and has no automatic backups. Vercel's Hobby plan is for non-commercial use. Both are fine for development, not for paying customers.

**When to change storage:** if customers upload lots of photos and you pass a few hundred GB, move files to [Cloudflare R2](https://developers.cloudflare.com/r2/pricing/): $0.015/GB-month and no charge for downloads. Not worth the extra setup at launch.

**Phone app later:** wrap the same app with Capacitor, or build a React Native app with Expo against the same Supabase backend. Apple and Google take 15% of in-app subscriptions for small developers, so let people subscribe on the website.

Prices checked Nov 20, 2026.

## Features

Seven modules, matching the prototype's tabs plus accounts and billing. Everything except the estimator sits behind the Build plan.

| Module | What the user does | What production adds beyond the prototype | Tier |
| --- | --- | --- | --- |
| Estimator | Enters square footage by area, finish level, region, land, DIY choices; gets a line-item budget, savings vs. a builder, schedule, sub list | Real regional cost data, editable line items and percentages, save as a project | Free |
| Spending | Logs expenses against budget lines with receipt photos; sees budget vs. committed vs. spent | Snap a receipt on the phone, CSV export, change orders, retainage held back from subs | Build |
| Bids | Enters bids per trade with the bid PDF; awards one, which becomes the committed cost | Side-by-side bid comparison, bid request email template, sub contact book | Build |
| Checklist | Ticks off tasks across 11 phases; inspections flagged | Due dates, reminders, photos per task, custom tasks, local inspection lists | Build |
| Draws | Sees which loan draw is ready; generates the request text for the lender | PDF draw package with receipts and lien waivers attached, track funded amounts | Build |
| Documents | Uploads plans, permits, contracts, bids, receipts, lien waivers, inspection reports, insurance, photos | Folders by phase, search, expiry reminders on insurance, share a read-only link with lender or spouse | Build |
| Account and billing | Signs up, subscribes, manages card, cancels | Free trial, Pro tier with multiple projects, invite a partner as a collaborator | All |

The prototype's calculation logic (cost model, schedule, draw percentages, checklist) is the starting reference. Port it into tested functions rather than rewriting it from scratch.

## Data model

Every row belongs to a project, and every project belongs to an account. Access is checked through project membership, so adding a collaborator later needs no schema change.

| Table | Key fields | Notes |
| --- | --- | --- |
| profiles | id (= auth user), name, created\_at | One per login |
| subscriptions | user\_id, stripe\_customer\_id, stripe\_subscription\_id, plan (free / build / pro), status, current\_period\_end | Written only by the Stripe webhook, never by the browser |
| projects | id, owner\_id, name, address, inputs (JSON: square footage, finish, region, land, DIY flags), created\_at | Build plan allows one active project; Pro unlimited |
| project\_members | project\_id, user\_id, role (owner / editor / viewer) | Basis for every security rule |
| budget\_lines | project\_id, key, division, name, budget\_amount, is\_diy | Seeded from the estimator, then editable |
| expenses | project\_id, budget\_line\_id, date, vendor, amount, note, document\_id | Amounts stored as integer cents |
| subs | project\_id, company, trade, phone, email, notes | Contact book |
| bids | project\_id, sub\_id, budget\_line\_id, amount, status (received / awarded / declined), document\_id | One awarded bid per trade |
| tasks | project\_id, phase, title, is\_inspection, done\_at, due\_date | Seeded from the default checklist |
| draws | project\_id, number, percent, amount, status (not ready / requested / funded), requested\_at, funded\_at | Five by default |
| documents | project\_id, type, title, budget\_line\_id, storage\_path, content\_type, size\_bytes, uploaded\_by | Files live in storage at `projects/{project_id}/{document_id}` |

## Security requirements

Customers will upload contracts, loan documents and receipts, so a leak of one customer's files to another is the failure that would end the business. These are non-negotiable from the first commit.

1. **Row-level security on every table.** Turn it on before writing any data; a user can read or write a row only if they're a member of its project. Write automated tests that sign in as user A and try to read user B's data.
2. **Private storage bucket.** No public file URLs. The app hands out signed links that expire in minutes, after checking project membership.
3. **Secrets stay on the server.** The Supabase service key and Stripe secret key live only in Vercel environment variables, never in browser code or the GitHub repo.
4. **Payments through Stripe only.** Use Stripe Checkout and the customer portal; no card numbers ever touch the app. Verify the signature on every Stripe webhook, and set plan status only from the webhook.
5. **Upload limits.** Accept PDF, JPEG, PNG and HEIC only, 25 MB max, checked on the server, not just in the browser.
6. **Accounts.** Email verification on signup, optional two-factor for users, required two-factor on your own Supabase, Vercel, Stripe and GitHub accounts.
7. **Backups and deletion.** Daily backups on (Supabase Pro). When a user deletes their account, delete their projects and files, and say so in the privacy policy.
8. **Legal basics before launch.** Terms of service and privacy policy; a clear note that estimates are not bids or financial advice.

## Build order

Ship the free estimator first so people can find it, then add paid features one at a time. Each phase ends with something live you can show someone.

1. **Foundation.** Next.js project, GitHub repo, Vercel deploys, Supabase project, sign-up and login, the projects and project\_members tables with security rules and their tests.
2. **Free estimator.** Port the prototype's cost model; save a project to your account; public landing page explaining the product.
3. **Payments.** Stripe Checkout for Build and Pro, the customer portal, the webhook that sets plan status, paywall on the tracking tabs, 14-day free trial.
4. **Spending and documents.** Budget lines, expenses, file uploads to the private bucket, budget vs. actual view.
5. **Bids and checklist.** Subs, bids with award flow, phase checklist with inspections, schedule tied to progress.
6. **Draws.** Draw readiness, request text, PDF draw package.
7. **Launch prep.** Terms, privacy policy, error monitoring, a beta with 5 to 10 owner-builders from Facebook groups and Reddit.
8. **Phone app.** Wrap the web app for iPhone and Android once people are paying.

## Starting in Claude Code

Export this doc as Markdown, save it in a new project folder as `BRIEF.md`, and give Claude Code the first prompt below.

Before the first session:

- [ ] Create free accounts at GitHub, Vercel, Supabase and Stripe (Stripe stays in test mode until launch)
- [ ] Turn on two-factor login for all four
- [ ] Pick and check the domain name (ownerbuilder.app or similar)
- [ ] Install the Claude desktop app or Claude Code on your computer

First prompt to paste:

```markdown
Read BRIEF.md. We're building OwnerBuilder, a Next.js + TypeScript + Tailwind app on Supabase (Postgres, Auth, Storage) hosted on Vercel, with Stripe subscriptions.

Start with phase 1 only: set up the project, Supabase auth (email + Google), the profiles, projects and project_members tables with row-level security, and automated tests proving one user cannot read another user's project. Explain each step as you go; I'm not a professional developer. Ask before creating any paid resource.
```

Work one phase per session, and ask Claude Code to run the security tests at the end of every phase.
