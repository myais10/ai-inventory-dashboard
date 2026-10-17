# Phoonica architecture

## Layers

```
src/lib/domain/      Pure, deterministic sales rules (no I/O) — unit tested in tests/
  dispositions.ts    Call outcomes → status, next action, cadence, task/meeting/deal intents
  scoring.ts         Explainable 0–100 lead score: fit + intent + engagement − friction
  queue.ts           Next Best Lead ranking with human-readable reasons
  outcome.ts         Turns one logged call into every row change (shared by app + seed)
  time.ts            Contact-timezone calling hours, business days, wall-clock parsing
src/lib/db/          Drizzle schema, driver selection (PGlite | node-postgres), demo-data simulation
src/lib/services/    Org-scoped queries and transactional mutations (the only code that touches the DB)
src/lib/providers/   Interfaces + demo implementations for phone, email, AI, enrichment, calendar, messaging
src/lib/auth/        scrypt passwords, HMAC-signed session cookie (Edge-safe), session → membership lookup
src/app/(app)/*      Server components per screen; server actions validate with zod and call services
src/components/      Shell, shortcuts layer, command palette, dialogs, toasts, timeline, charts
```

## Data model

`organizations` ← `memberships` (owner | manager | rep) → `users`.
Every business table carries `org_id`; every service query filters on it.

`companies` 1—n `contacts` 1—1 `leads` (the sales-workflow wrapper: owner, campaign, status, score, cadence,
next action). `calls` record each dial; `activities` is the single timeline for leads, companies and deals.
`tasks` (auto-created ones are flagged `auto` so a newer outcome can supersede them), `meetings`,
`pipeline_stages` (open | won | lost with probabilities) and `deals`.

## One write path per workflow

`services/calls.ts#logCallOutcome` is the only way a call outcome is recorded. In one transaction it closes the
call, writes the timeline entry, applies the disposition rules, completes superseded auto-tasks, creates the
callback / follow-up / meeting-prep task, books the meeting, opens the deal, updates contact flags (do-not-call,
wrong number), claims unassigned leads and rescores. Deal stage changes (`services/deals.ts`) likewise keep the
lead in sync (won → converted). This is why the same lead reads consistently across the lead database, desk,
timeline, tasks, pipeline and analytics.

## Demo data is simulated, not hand-placed

`db/seed.ts` generates companies and contacts, imports them weekly as campaigns, then simulates each rep's
working days: every call is picked by the real `rankQueue` and resolved by the real `buildCallOutcome`, with
deals advancing through stages over time. History therefore obeys the same rules as live use.

## Decisions and trade-offs

- **Replaced the inventory app on this branch.** No Phoonica Calling Desk code existed in the accessible repo, so
  Phoonica reuses the previous app's foundation (Next.js, Tailwind, UI primitives, signed-cookie session pattern,
  multi-tenant design) and replaces its domain. The inventory product remains on `main`.
- **Postgres everywhere, embedded in dev.** PGlite gives real Postgres semantics with zero setup; production uses the
  same schema and migrations over `DATABASE_URL`. PGlite is single-process: stop the dev server before `npm run db`.
- **App-owned auth instead of Supabase Auth.** The app owns its database, so users and memberships live there.
  Enterprise SSO is out of scope for the MVP.
- **Simple role model.** Reps work their own leads and can claim unassigned ones; managers work any lead and assign;
  owners manage members. Advanced permissions are deliberately deferred.
- **Rules-based "AI".** Call prep is generated from lead data by `demoAI` and labelled as such; an LLM provider can
  implement the same `AIProvider` interface.

## Design system

The UI implements the Phoonica Design Kit. Tokens live in `src/app/globals.css` (`@theme`), named by role so
components never hard-code hex values:

| Token | Value | Use |
|---|---|---|
| `canvas` / `surface` / `subtle` | #0A0B0F / #11131A / #161922 | page / cards, sidebar, tables / inputs, hover, table header |
| `line` / `line-strong` | #1F2430 / #2B3242 | borders / input and hover borders |
| `ink` / `ink-2` / `muted` / `faint` | #F9FAFB / #CBD5E1 / #94A3B8 / #64748B | text hierarchy |
| `brand-500` (primary) / `brand-800` / `brand-300` | #7C3AED / #5B21B6 / #A78BFA | primary actions, active states / pressed / accents and links |
| `brand-50`, `brand-100` | dark purple tints | selected rows, active nav |
| accent / success / warning / danger | #22D3EE / #10B981 / #F59E0B / #EF4444 | status only |

Typography is Inter: page title 22/30 semibold, section titles 13–14 semibold, body 13–14, metadata 11–12,
all numbers `tabular-nums`. Radius 4/8/12/16 (inputs and buttons 8, cards 12). Two shadows: `shadow-card` and
`shadow-elevated` (popovers, dialogs, the Next Best Lead card).

Shared primitives (`src/components/ui`): `Button`/`buttonClass` (primary · secondary · tertiary · ghost · danger —
one primary per area), `IconButton`, `Badge` (status tag: tinted pill + dot, never color alone), `Panel`
(titled section with icon tile), `Metric` (KPI tile), `Tabs`, `EmptyState`, `thClass`/`tdClass`, `Dialog`, toasts,
and `Link` (no prefetch by default). Icons are lucide at stroke 1.75. Status language: lead status
(New · Attempting · Connected · Qualified · Nurture · Unqualified · Customer), temperature (Hot · Warm · Cold),
call outcomes, and rep presence (On call · Available · Idle · Offline — derived from call activity).
