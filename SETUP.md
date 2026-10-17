# Phoonica: setup and handover guide

This is the complete handover document for the Phoonica application. It explains what the app is, how to run it,
how it is built, and what is real versus simulated. For a file-by-file and feature-by-feature list, see
[INVENTORY.md](INVENTORY.md). For design decisions, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

- Source branch: `claude/sweet-hamilton-bsoo8h` in `myais10/ai-inventory-dashboard` (the `main` branch of that
  repository holds an older, unrelated inventory dashboard; Phoonica replaced it on this branch only).
- Package name / version: `phoonica` 0.1.0.

---

## 1. What Phoonica is

Phoonica is a calling-first sales workspace for SDR / inside-sales teams. It decides **who to call next and why**,
makes logging a call a one-keystroke job, and turns every call outcome into the right next action automatically:

**Find lead → understand lead → call → log outcome → next action scheduled → follow up → qualify → close.**

Core modules: Calling Desk (Next Best Lead queue + dialer + outcomes + call prep), Lead Database, Lead Detail,
Companies, Tasks, Pipeline (board + deal workspace), Sales Floor (live manager view), Analytics, Settings
(workspace/ICP, team, integrations, data, profile). It is multi-tenant (organizations / workspaces) with three
roles: owner, manager, rep.

## 2. Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15.5 (App Router, React Server Components, server actions), React 19.1 |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`), design tokens in `src/app/globals.css` |
| Font / icons | Inter via `next/font/google` (downloaded at build time), `lucide-react` icons |
| Database | PostgreSQL via Drizzle ORM 0.45. Embedded **PGlite** (Postgres compiled to WASM) in development; `pg` (node-postgres) when `DATABASE_URL` is set |
| Migrations | drizzle-kit (SQL files in `drizzle/`), applied automatically at startup |
| Validation | zod 4 |
| Auth | App-owned: scrypt password hashes + HMAC-SHA256 signed session cookie (Web Crypto, Edge-safe) |
| Tests | Node test runner via `tsx` (domain unit tests), Playwright (end-to-end) |
| Lint | ESLint 9 with `eslint-config-next` |

## 3. Project structure

```
.
├── src/
│   ├── middleware.ts            Route guard (cookie signature check; redirects to /login)
│   ├── app/
│   │   ├── layout.tsx           Root HTML layout, Inter font, metadata
│   │   ├── globals.css          Design system tokens (Phoonica Design Kit) + base styles
│   │   ├── not-found.tsx, favicon.ico
│   │   ├── (auth)/              Login + signup pages and their server actions
│   │   ├── auth/signout/        GET route that clears the session cookie
│   │   └── (app)/               Signed-in app: layout (shell), one folder per screen
│   │       ├── desk/            Calling Desk
│   │       ├── leads/           Lead database + [id] lead detail
│   │       ├── companies/       Company list + [id] company detail
│   │       ├── tasks/           Task list
│   │       ├── pipeline/        Board + [id] deal workspace
│   │       ├── sales-floor/     Manager live view (/team redirects here)
│   │       ├── analytics/       Reporting
│   │       └── settings/        Workspace, team, integrations, data, profile
│   ├── components/
│   │   ├── ui/                  Design-system primitives (Button, Badge, Panel, Metric, Dialog, Toast, Link…)
│   │   ├── app/                 App shell, nav, shortcuts, forms, timeline, task list, badges, live refresh
│   │   └── charts/              Column chart + bar list (pure SVG/CSS)
│   └── lib/
│       ├── domain/              Pure sales rules: dispositions, scoring, queue ranking, outcome builder, time zones
│       ├── services/            All database reads/writes, org-scoped
│       ├── db/                  Drizzle schema, driver selection, demo-data simulation (seed)
│       ├── auth/                Password hashing, session token, session lookup, login throttle
│       ├── providers/           Phone / email / AI / enrichment / calendar / messaging interfaces + demo impls
│       ├── format.ts, period.ts, utils/
├── drizzle/                     SQL migration + drizzle-kit metadata
├── scripts/db.ts                Database CLI (migrate / seed / reset / stats)
├── tests/domain.test.ts         15 unit tests for the domain engine
├── e2e/                         Playwright end-to-end specs
├── docs/ARCHITECTURE.md         Architecture, data model, design system
├── README.md, SETUP.md, INVENTORY.md
├── package.json, package-lock.json, tsconfig.json, next.config.ts, drizzle.config.ts,
├── postcss.config.mjs, eslint.config.mjs, playwright.config.ts, .env.example, .gitignore
```

The export ZIP also contains `extras/lead-desk-artifact/`, a separate single-file app (see section 17).

## 4. Requirements

- **Node.js 20 LTS or 22 LTS** (developed and verified on Node 22.22.0). Next.js 15 needs at least 18.18; 20+ is
  recommended.
- npm 10 (ships with Node 20/22). The `package-lock.json` is included; use `npm ci` for an exact install.
- Internet access during `npm install` and during the first build (Next downloads the Inter font from Google Fonts).
- No database server is needed for local development.

## 5. Install and run locally

```bash
npm ci                 # or: npm install
npm run dev            # http://localhost:3000
```

On first start with no `DATABASE_URL`, Phoonica:
1. creates an embedded Postgres database in `./.data/pglite`,
2. applies the migrations in `drizzle/`,
3. generates the **Brightline Field Software** demo workspace (takes a few seconds; see section 8).

Open http://localhost:3000. You are redirected to `/login`, which shows one-click demo seats.

Production build locally:

```bash
npm run build
npm start              # http://localhost:3000
```

## 6. Environment variables

Copy `.env.example` to `.env.local` (Next.js loads it automatically). Everything is optional in development.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Production | unset → embedded PGlite in `./.data/pglite` | Postgres connection string (Supabase, Neon, RDS, local Postgres…) |
| `DATABASE_POOL_MAX` | No | `10` | Max connections per server instance (use a small number behind pgbouncer / serverless) |
| `AUTH_SECRET` | **Yes in production** | dev-only fallback secret | Signs the session cookie. In production the app refuses to issue or verify sessions without it |
| `PHONE_PROVIDER` | No | `demo` | Selects the phone provider from the registry in `src/lib/providers/index.ts` |
| `EMAIL_PROVIDER` | No | `demo` | Email provider |
| `AI_PROVIDER` | No | `demo` | AI call-prep provider |
| `ENRICHMENT_PROVIDER` | No | `demo` | Contact enrichment provider |
| `CALENDAR_PROVIDER` | No | `demo` | Calendar provider |
| `MESSAGING_PROVIDER` | No | `demo` | SMS / WhatsApp provider (read by the code; not listed in `.env.example`) |
| `PHOONICA_ALLOW_DEV_SECRET` | No | unset | When `1`, lets a production build start without `AUTH_SECRET` (uses the insecure dev secret; for local `npm start` testing only) |
| `PHOONICA_NO_AUTOSEED` | No | unset | When `1`, the app does not auto-seed an empty database (the `db` script sets this itself) |
| `BASE_URL` | Tests only | `http://localhost:3000` | Server the Playwright tests hit |
| `PW_CHROMIUM` | Tests only | unset | Path to a local Chromium for Playwright |

Unknown provider ids fall back to the demo implementation, so the app always starts.

## 7. Database setup and migrations

- **Development:** nothing to do. PGlite stores data in `./.data/pglite` (git-ignored). PGlite is single-process:
  **stop `npm run dev` before running `npm run db -- …`** against the embedded database.
- **Production / shared Postgres:** create a database, set `DATABASE_URL`, start the app. Migrations in `drizzle/`
  are applied automatically on first connection (`src/lib/db/index.ts`). You can also run them explicitly with
  `npm run db -- migrate`.
- **Changing the schema:** edit `src/lib/db/schema.ts`, run `npm run db:generate` (drizzle-kit writes a new SQL file to
  `drizzle/`), commit it. It is applied on next start.

Schema overview (12 tables, 3 enums) is in [INVENTORY.md](INVENTORY.md#database).

## 8. Seed / demo data

The demo workspace is **simulated, not hand-placed** (`src/lib/db/seed.ts`): it generates ~420 companies and ~700
leads, imports them weekly as campaigns, then simulates six weeks of SDR working days where every call is picked by
the real Next Best Lead ranking and resolved by the real outcome engine. Deals advance through pipeline stages over
time. So history, tasks, meetings, deals and analytics are all consistent with the live rules.

| Command | What it does |
|---|---|
| (automatic) | An empty database is seeded on first start (unless `PHOONICA_NO_AUTOSEED=1`) |
| `npm run db -- seed` | Seed an empty database (works with `DATABASE_URL` too); refuses if data exists |
| `npm run db -- reset` | Delete `./.data/pglite` and regenerate the demo workspace (embedded DB only) |
| `npm run db -- stats` | Print row counts |
| Settings → Data | Owners can reset the demo data or clear the workspace from the UI |
| Sign up with "sample data" | Creates a new workspace pre-filled with simulated data |

## 9. Demo login credentials

Password for every demo seat: **`phoonica-demo`**

| Role | Email | Name |
|---|---|---|
| Owner | `jordan@brightline.demo` | Jordan Reyes (VP of Sales) |
| Manager | `dana@brightline.demo` | Dana Brooks (SDR Manager) |
| Rep | `sam@brightline.demo` | Sam Whitfield (SDR) |
| Rep | `priya@brightline.demo` | Priya Shah (SDR) |
| Rep | `marcus@brightline.demo` | Marcus Lee (SDR) |
| Rep | `elena@brightline.demo` | Elena García (Senior SDR) |

The login page shows one-click buttons for these seats only when the demo users exist in the database.
You can also sign up at `/signup` to create your own empty workspace (you become its owner).

## 10. Available scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `next dev` | Development server on :3000 |
| `npm run build` | `next build` | Production build |
| `npm start` | `next start` | Serve the production build |
| `npm run lint` | `eslint` | Lint |
| `npm run typecheck` | `tsc --noEmit` | Type check |
| `npm test` | `tsx --test tests/*.test.ts` | 15 domain unit tests (cadence, scoring, queue, time zones) |
| `npm run db -- <cmd>` | `tsx scripts/db.ts` | `migrate`, `seed`, `reset`, `stats` |
| `npm run db:generate` | `drizzle-kit generate` | Create a migration from schema changes |
| `npx playwright test` | Playwright | E2E specs in `e2e/` against a running server |

E2E: start the app (`npm run build && npm start` is the most reliable), then `npx playwright test`. Install a
browser first with `npx playwright install chromium`, or point `PW_CHROMIUM` at an existing Chromium. The specs run
against the demo workspace and change its data; `npm run db -- reset` restores it.

## 11. How authentication works

- **Users and memberships live in the app's own database** (`users`, `memberships`). No external auth service.
- **Passwords:** scrypt with a random salt (`src/lib/auth/password.ts`).
- **Session:** after login, the server sets an HttpOnly, SameSite=Lax cookie `phoonica_session` containing
  `{uid, oid, iat}` signed with HMAC-SHA256 using `AUTH_SECRET` (`src/lib/auth/token.ts`). Lifetime 14 days.
- **Middleware** (`src/middleware.ts`) verifies the signature on every request (Edge-safe Web Crypto) and redirects
  unauthenticated users to `/login?next=…`, and signed-in users away from `/login` and `/signup`.
- **Membership re-check:** every server render/action calls `requireSession()` (`src/lib/auth/session.ts`), which
  loads the user and their membership in the cookie's organization. If the member was removed, they are sent to
  `/auth/signout`, which clears the cookie.
- **Roles:** `owner`, `manager`, `rep` (`isManager` = owner or manager; `requireManager` guards manager pages).
- **Login throttling:** 8 failed attempts per email and 50 per client IP in a 15-minute window, held in server memory
  (`src/lib/auth/throttle.ts`).
- **Workspaces:** a user can belong to several organizations and switch from the shell (re-issues the cookie).

## 12. How the main modules work

**Data flow.** Pages are server components that call services in `src/lib/services/*` (every query filtered by
`org_id`). Mutations are server actions (`actions.ts` next to each page) that validate input with zod, call a
service, and revalidate. Errors meant for users are thrown as `UserError`; anything else becomes a generic message.

**Domain engine (`src/lib/domain`, pure and unit-tested).**
- `dispositions.ts`: 10 call outcomes (No answer, Left voicemail, Busy, Gatekeeper, Interested, Callback requested,
  Meeting booked, Not interested, Wrong number, Do not call) mapped to a lead status, the next action, retry cadence
  and task/meeting/deal intents. No-answer cadence escalates; after 6 attempts a lead moves to nurture.
- `scoring.ts`: explainable 0–100 lead score (fit + intent + engagement − friction) with factor list and
  Hot / Warm / Cold tiers.
- `queue.ts`: Next Best Lead ranking: score plus boosts for promised callbacks, inbound speed-to-lead (+50 under one
  hour), overdue follow-ups; minus contacts outside their local calling hours (9:00–17:00 contact time). Every rank
  carries human-readable reasons.
- `outcome.ts`: `buildCallOutcome` turns one logged call into every row change (shared by live app and seed).
- `time.ts`: contact-timezone calling hours, business days, wall-clock parsing.

**One write path.** `services/calls.ts#logCallOutcome` records an outcome in one transaction (row-locks the lead):
closes the call, writes the timeline entry, applies the disposition, completes superseded auto-tasks, creates the
callback / follow-up / meeting-prep task, books the meeting, opens the deal, sets do-not-call / wrong-number flags,
claims unassigned leads, rescores. Deal stage moves (`services/deals.ts`) keep the lead in sync (won → Customer).

**Calling Desk (`/desk`).** Queue of due leads ranked by Next Best Lead with reasons; the current lead card with
contact, company, score, local time; Call now / Hang up (demo dialer starts and ends a `calls` row and times it);
grouped outcome buttons with keyboard shortcuts 1–0; callback time / meeting time / not-interested reason fields;
notes; Save & next; Skip; Call assist panel with call prep (opener, talking points, likely objection) from the AI
provider; today's stats. `?lead=<id>` opens a specific lead on the desk.

**Leads (`/leads`, `/leads/[id]`).** Filterable, paginated table (status, owner, campaign, free-text search),
keyboard navigation, bulk select and assign (managers). Lead detail: contact and company info, score breakdown,
status changes, notes, editable contact fields, full timeline, tasks, deals, call button.

**Companies (`/companies`, `/companies/[id]`).** Account list with ICP fit and filters; account page with people,
deals, open pipeline value and account-wide activity.

**Tasks (`/tasks`).** Overdue / today / upcoming / completed buckets, complete / reopen / reschedule / create,
assignee filter for managers. Most tasks are created automatically by call outcomes.

**Pipeline (`/pipeline`, `/pipeline/[id]`).** Board of 7 stages (Meeting Booked 20%, Discovery 30%, Demo 50%,
Proposal 70%, Negotiation 85%, Closed Won, Closed Lost) with weighted values, move between stages (lost requires a
reason), owner filter. Deal workspace: stage stepper, mark won/lost, editable name / value / expected close / next
step, tasks, meetings with held / no-show outcome, contact, activity timeline.

**Sales Floor (`/sales-floor`, managers).** Rep presence derived from call activity (On call / Available / Idle /
Offline), per-rep table for the period (dials, connects, conversations, meetings, opportunities, open value, backlog),
live recent calls, unassigned leads with inline assignment, late callbacks, deals stuck 10+ days, meetings in the
next 7 days. Auto-refreshes every 30 seconds.

**Analytics (`/analytics`).** Period tabs; KPIs (calls, connects, conversations 1 min+, meetings, deals won, revenue);
conversion funnel; dials per day; connect rate by contact local hour; outcome breakdown; rep performance (managers,
drill-down per rep); lead sources; campaigns; loss and disqualification reasons. Reps see their own numbers.

**Settings (`/settings`).** Workspace name, timezone and ICP (industries, employee range) which drive scoring;
team members (owners add/remove members and change roles); integrations status (each provider labelled Demo or
Live); data (reset demo data / clear workspace, owners only); your profile.

**Shell.** Sidebar navigation with badges (queue due, tasks due, unassigned), workspace switcher, global search
(`⌘K` or `/`) across leads and companies, notifications, keyboard shortcuts (`?` shows them), toasts.

## 13. Integrations: real vs mocked

| Integration | Status | Notes |
|---|---|---|
| PostgreSQL database | **Real** | Embedded PGlite or any Postgres via `DATABASE_URL` |
| Authentication | **Real** | App-owned, production-capable (see section 11) |
| Phone / dialer | **Demo** | `demoPhone` creates a call record and timer but places no real call. Reps dial from their own phone and log the outcome. Labelled "Demo" in the UI |
| Email | **Demo** | Records on the timeline; never sends |
| AI call prep | **Demo (rules-based)** | `demoAI` builds opener, talking points and likely objection from lead data with fixed rules. No LLM is called |
| Enrichment | **Demo** | Returns no data |
| Calendar | **Demo** | Meetings stored in Phoonica only; no invites |
| SMS / WhatsApp | **Demo** | Not connected |

Interfaces are in `src/lib/providers/types.ts`. To add a real service (e.g. Twilio, SendGrid, Anthropic/OpenAI,
Google Calendar, Apollo/Clearbit), implement the interface, register it in `src/lib/providers/index.ts` under an id,
set the env var (e.g. `PHONE_PROVIDER=twilio`) and add that service's credentials as new env vars.

**Requires external credentials before it can be real:** phone (e.g. Twilio account SID / auth token / caller number
and a webhook for call status + recordings), email sending, an LLM API key for AI call prep, an enrichment API key,
calendar OAuth, SMS/WhatsApp. None of these are implemented yet beyond the interface.

## 14. Deploying

Any Node host that runs `next start` works (Vercel, Render, Railway, Fly.io, a VM, Docker).

1. Provision Postgres and set `DATABASE_URL` (embedded PGlite is for development; do not rely on it on serverless or
   multi-instance hosts because it writes to the local disk).
2. Set `AUTH_SECRET` to a long random string (e.g. `openssl rand -base64 48`).
3. Optionally set `DATABASE_POOL_MAX` (small, e.g. 3–5, on serverless or behind pgbouncer).
4. `npm ci && npm run build && npm start`. Migrations run on first connection.
5. Optional: `npm run db -- seed` once to load the demo workspace.
6. Serve over HTTPS (the session cookie is marked `Secure` in production).

Vercel: import the repo, set the env vars above, default build command. `next.config.ts` already marks PGlite as a
server-external package and sets security headers.

## 15. Known limitations

- Phone, email, AI, enrichment, calendar and messaging are demo providers (section 13). There is no real dialer,
  recording, transcription or LLM yet.
- Login throttling is in server memory; with more than one instance use a shared store (e.g. Redis).
- No password reset / email verification / SSO.
- Role model is simple (owner / manager / rep); no custom permissions.
- No CSV lead import UI; leads come from the seed or would be inserted via the services layer.
- PGlite is single-process (stop the dev server before running `npm run db`).
- E2E tests change demo data; reset between runs if needed. Two pipeline e2e cases skip when no unassigned leads
  remain.
- The production build needs internet access to fetch the Inter font.

## 16. Things another developer should know

- Keep all database access in `src/lib/services`, always filtered by `ctx.orgId`.
- Record call outcomes only through `logCallOutcome`; change sales rules in `src/lib/domain` and extend
  `tests/domain.test.ts`.
- Use the design tokens (`bg-surface`, `text-ink`, `border-line`, `brand-*`…) and primitives in
  `src/components/ui`; do not hard-code colors. Icons: lucide at `strokeWidth={1.75}`.
- `src/components/ui/link.tsx` disables prefetch by default on purpose (big tables made too many prefetches).
- Server actions return `{ ok, error }`; throw `UserError` for messages that are safe to show.
- `/team` permanently redirects to `/sales-floor`.
- Quality gate used during development: `npm run typecheck && npm run lint && npm test && npm run build`, plus the
  Playwright suite against the production build.

## 17. Extra: Lead Desk single-file app (`extras/lead-desk-artifact/`, ZIP only)

A separate, self-contained Phoonica-styled calling app built for the user's own spreadsheet
"Lead Desk – East Coast Website Leads (100)". It is **not** part of the Next.js app.

- `phoonica-desk.html`: vanilla HTML/CSS/JS. Calling Desk with Next Best Lead ranking, cold-call script and email
  built from each lead's pitch hook, outcomes that set status and the next follow-up, Leads table with filters,
  lead page (notes, status, deal value, follow-up), Follow-ups, Pipeline (Interested → Meeting booked → Proposal sent
  → Won / Lost), Stats, Settings (caller name, agency, CSV export).
- It runs as a claude.ai Artifact and stores data with the artifact `db` capability (collections `leads`, `calls`,
  doc `settings/main`) and exports CSV through the `downloads` capability. Outside claude.ai there is no storage
  backend, so the page shows a sign-in notice; to run it elsewhere, replace the `claude.use("db")` calls with
  another store (e.g. the Next.js app's services or localStorage).
- `seed/L001.json … L100.json`: the 100 leads as loaded into that artifact's database.
- Live copy: https://claude.ai/artifact/3SEobAjJP9QfBGRXy95s1V (private to its owner).
