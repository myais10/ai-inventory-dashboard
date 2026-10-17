# Phoonica inventory

Complete inventory of the Phoonica application as of branch `claude/sweet-hamilton-bsoo8h`.
Setup and operations are in [SETUP.md](SETUP.md); architecture in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Contents: [Features](#features) · [Routes](#routes--pages) · [Endpoints](#api-endpoints) · [Database](#database) ·
[Integrations](#integrations) · [AI features](#ai-features) · [Roles](#user-roles) · [UI components](#major-ui-components) ·
[Files](#file-inventory) · [Extras](#extras-zip-only)

---

## Features

| Feature | Where | Notes |
|---|---|---|
| Next Best Lead queue with reasons | Desk, `domain/queue.ts`, `services/desk.ts` | Score + callback / speed-to-lead / overdue boosts, calling-hours penalty |
| Calling Desk cockpit | `/desk` | Current lead card, Call now / Hang up with timer, grouped outcomes, notes, Save & next, Skip, today's stats |
| 10 call dispositions with automatic next action | `domain/dispositions.ts` | Status change, retry cadence, callback / follow-up / meeting-prep tasks, meeting + deal creation, DNC / wrong-number flags |
| Single transactional write path for outcomes | `services/calls.ts#logCallOutcome` | Row-locked, keeps leads, tasks, meetings, deals, timeline and score consistent |
| Explainable lead scoring + temperature | `domain/scoring.ts` | 0–100 with factor list; Hot / Warm / Cold |
| Call-hours awareness | `domain/time.ts` | Contact-timezone 9:00–17:00, business days, local time labels |
| Call assist / call prep | Desk side panel, `providers` AI | Opener, talking points, likely objection (rules-based demo) |
| Lead database | `/leads` | Filters (status, owner, campaign, search), pagination, keyboard nav, bulk select + assign |
| Lead detail | `/leads/[id]` | Contact/company, score breakdown, status, notes, editable contact, timeline, tasks, deals, call button |
| Companies | `/companies`, `/companies/[id]` | ICP fit, people, deals, open value, account activity |
| Tasks | `/tasks` | Overdue / Today / Upcoming / Done, complete, reopen, reschedule, create, assignee filter |
| Pipeline board | `/pipeline` | 7 stages, weighted value, move with lost-reason dialog, owner filter |
| Deal workspace | `/pipeline/[id]` | Stage stepper, won/lost, edit fields, tasks, meetings (held / no-show), contact, timeline |
| Sales Floor (manager live view) | `/sales-floor` | Rep presence, rep table, live calls, unassigned leads + inline assign, late callbacks, stuck deals, upcoming meetings, 30 s auto-refresh |
| Analytics | `/analytics` | KPIs with deltas, funnel, dials/day, connect rate by local hour, outcomes, rep performance, sources, campaigns, loss reasons |
| Settings | `/settings` | Workspace + ICP, team management, integrations status, data reset/clear, profile |
| Multi-workspace | Shell, `actions.ts` | Users can belong to several orgs and switch |
| Global search | Shell (`⌘K` / `/`) | Leads and companies |
| Notifications | Shell bell, `services/notifications.ts` | Due callbacks, meetings, etc. |
| Nav badges | `services/badges.ts` | Queue due, tasks due, unassigned leads |
| Keyboard shortcuts | `components/app/shortcuts.tsx` | `?` help, g-sequences, desk 1–0 outcomes, list J/K/Enter/C/X |
| Auth | `(auth)`, `lib/auth`, middleware | Signup, login (throttled), logout, signed cookie, membership re-check |
| Simulated demo workspace | `lib/db/seed.ts` | ~420 companies, ~700 leads, six weeks of simulated activity using the real engine |
| Security headers | `next.config.ts` | X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy |

## Routes / pages

| Route | File | Access | Purpose |
|---|---|---|---|
| `/` | `src/app/(app)/page.tsx` | Signed in | Redirects managers/owners to `/sales-floor`, reps to `/desk` |
| `/login` | `src/app/(auth)/login/page.tsx` | Public | Sign in; one-click demo seats when demo users exist |
| `/signup` | `src/app/(auth)/signup/page.tsx` | Public | Create account + workspace (optional sample data) |
| `/auth/signout` | `src/app/auth/signout/route.ts` | Any | GET route: clears session cookie, redirects to `/login` |
| `/desk` (`?lead=<id>`) | `src/app/(app)/desk/page.tsx` | All roles | Calling Desk |
| `/leads` | `src/app/(app)/leads/page.tsx` | All roles | Lead database |
| `/leads/[id]` | `src/app/(app)/leads/[id]/page.tsx` | All roles | Lead detail |
| `/companies` | `src/app/(app)/companies/page.tsx` | All roles | Companies |
| `/companies/[id]` | `src/app/(app)/companies/[id]/page.tsx` | All roles | Company detail |
| `/tasks` | `src/app/(app)/tasks/page.tsx` | All roles | Tasks |
| `/pipeline` | `src/app/(app)/pipeline/page.tsx` | All roles | Pipeline board |
| `/pipeline/[id]` | `src/app/(app)/pipeline/[id]/page.tsx` | All roles | Deal workspace |
| `/sales-floor` | `src/app/(app)/sales-floor/page.tsx` | Owner, manager | Live team view |
| `/team` | `next.config.ts` | — | Permanent redirect to `/sales-floor` |
| `/analytics` | `src/app/(app)/analytics/page.tsx` | All roles (reps see own data) | Reporting |
| `/settings` | `src/app/(app)/settings/page.tsx` | All roles (sections gated by role) | Settings |
| (404) | `src/app/not-found.tsx` | — | Not found page |

## API endpoints

Phoonica uses Next.js **server actions** (POST requests generated by Next) instead of a REST API, plus one GET route.

| Endpoint | File | Role | Does |
|---|---|---|---|
| `GET /auth/signout` | `src/app/auth/signout/route.ts` | Any | Clear cookie, redirect to login |
| `loginAction` | `src/app/(auth)/actions.ts` | Public | Validate, throttle, verify password, start session |
| `signupAction` | same | Public | Create user + org (owner) + default stages, optional demo data |
| `logoutAction` | same | Any | End session |
| `searchAction` | `src/app/(app)/actions.ts` | Member | Global search over leads and companies |
| `switchWorkspaceAction` | same | Member | Switch active organization |
| `startCallAction` | `src/app/(app)/desk/actions.ts` | Member who can work the lead | Place call via phone provider, create `calls` row |
| `endCallAction` | same | Same | End call, record duration |
| `logCallAction` | same | Same | Log disposition through `logCallOutcome` |
| `assignLeadsAction` | `src/app/(app)/leads/actions.ts` | Manager | Assign / unassign leads |
| `setLeadStatusAction` | same | Can work lead | Change lead status |
| `addNoteAction` | same | Can work lead | Add timeline note |
| `updateContactAction` | same | Can work lead | Edit contact fields |
| `moveDealAction` | `src/app/(app)/pipeline/actions.ts` | Deal owner / manager | Move stage (lost reason) |
| `updateDealAction` | same | Same | Edit name, value, close date, next step |
| `createDealAction` | same | Can work lead | Open a deal from a lead |
| `meetingOutcomeAction` | same | Same | Mark meeting held / no-show |
| `completeTaskAction`, `reopenTaskAction`, `rescheduleTaskAction`, `createTaskAction` | `src/app/(app)/tasks/actions.ts` | Assignee / manager | Task lifecycle |
| `updateWorkspaceAction` | `src/app/(app)/settings/actions.ts` | Owner / manager | Workspace name, timezone, ICP |
| `addMemberAction`, `updateMemberRoleAction`, `removeMemberAction` | same | Owner | Team management |
| `updateProfileAction` | same | Any | Name / password |
| `resetDemoAction`, `clearDataAction` | same | Owner | Regenerate demo data / clear workspace |

## Database

PostgreSQL, defined in `src/lib/db/schema.ts`, migration `drizzle/0000_init.sql`. Every business table has `org_id`.

| Table | Key columns | Relations |
|---|---|---|
| `organizations` | name, timezone, icp_industries[], icp_min/max_employees | Root tenant |
| `users` | email (unique), name, password_hash | — |
| `memberships` | (org_id, user_id) PK, role (owner/manager/rep), title | org ↔ user |
| `companies` | name, domain, industry, employee_count, annual_revenue, city, state, phone, description | org |
| `contacts` | first/last name, title, seniority, email, phone, mobile, timezone, do_not_call, phone_invalid | company |
| `campaigns` | name, description, active | org |
| `leads` | status, source, score, score_factors (jsonb), attempt/connect counts, last_contacted_at, last_disposition, next_action_at/type/reason, unqualified_reason | contact (1:1), company, campaign, owner (user) |
| `calls` | provider, provider_call_id, to_number, status, started/answered/ended_at, duration_sec, disposition, notes, recording_url | lead, user |
| `activities` | type (call, note, email, status_change, stage_change, meeting_booked, task_completed, assignment, deal_created), title, body, meta | lead, company, deal, user, call |
| `tasks` | type, title, notes, due_at, completed_at, auto | lead, deal, assignee, creator |
| `meetings` | title, scheduled_at, duration_min, status (scheduled/held/no_show/cancelled), calendar_provider, external_id | lead, deal, user |
| `pipeline_stages` | name, position, probability, kind (open/won/lost) | org |
| `deals` | name, value (USD/yr), expected_close_date, stage_changed_at, closed_at, lost_reason, next_step | lead, company, contact, owner, stage |

Enums: `role`, `lead_status` (new, attempting, connected, qualified, nurture, unqualified, converted = "Customer"),
`stage_kind`. Default stages: Meeting Booked 20 · Discovery 30 · Demo 50 · Proposal 70 · Negotiation 85 · Closed Won ·
Closed Lost.

## Integrations

| Integration | Interface | Implementation | Env var | Status |
|---|---|---|---|---|
| Postgres | Drizzle | PGlite (dev) / node-postgres | `DATABASE_URL` | Real |
| Phone / dialer | `PhoneProvider` (placeCall, hangup, getRecordingUrl) | `demoPhone` | `PHONE_PROVIDER` | Demo |
| Email | `EmailProvider` (send) | `demoEmail` | `EMAIL_PROVIDER` | Demo |
| AI | `AIProvider` (callPrep) | `demoAI` (rules) | `AI_PROVIDER` | Demo |
| Enrichment | `EnrichmentProvider` (enrichContact) | `demoEnrichment` | `ENRICHMENT_PROVIDER` | Demo |
| Calendar | `CalendarProvider` (createEvent) | `demoCalendar` | `CALENDAR_PROVIDER` | Demo |
| SMS / WhatsApp | `MessagingProvider` (send) | `demoMessaging` | `MESSAGING_PROVIDER` | Demo |
| Google Fonts (Inter) | `next/font/google` | Build-time download | — | Real |

All demo providers report `live: false` and are labelled "Demo" in Settings → Integrations and on the desk.

## AI features

| Feature | Implementation | Real AI? |
|---|---|---|
| Call prep (opener, talking points, likely objection) on the Calling Desk | `AIProvider.callPrep`, `demoAI` in `src/lib/providers/demo.ts`; input built in `desk/page.tsx` | No: rules-based from lead data. Swap in an LLM provider via the same interface |
| Next Best Lead ranking with reasons | `src/lib/domain/queue.ts` | Deterministic rules, not ML |
| Lead scoring with explanations | `src/lib/domain/scoring.ts` | Deterministic rules, not ML |

## User roles

| Role | Can |
|---|---|
| Rep | Calling Desk, own leads and unassigned leads (claims on call), own tasks, own deals, own analytics, profile |
| Manager | Everything a rep can, on every lead; assign leads; Sales Floor; team analytics and rep drill-down; workspace settings |
| Owner | Everything a manager can; add / remove members and change roles; reset demo data; clear workspace |

## Major UI components

| Component | File | Purpose |
|---|---|---|
| `AppShell` | `src/components/app/shell.tsx` | Sidebar, workspace switcher, search palette, notifications, user menu, mobile nav |
| `NAV` | `src/components/app/nav.ts` | Navigation items, groups, shortcuts, badges, manager-only flags |
| `ShortcutsProvider`, `useShortcuts`, `Kbd` | `src/components/app/shortcuts.tsx` | Keyboard shortcut layer and `?` help |
| `Desk` | `src/app/(app)/desk/desk.tsx` | Calling Desk client cockpit |
| `LeadTable`, `LeadFiltersBar` | `src/app/(app)/leads/*` | Lead list, filters, bulk assign |
| `LeadActions`, `NoteComposer` | `src/app/(app)/leads/[id]/lead-client.tsx` | Lead detail actions |
| `Board`, `LostReasonDialog` | `src/app/(app)/pipeline/board.tsx` | Pipeline board |
| `StageStepper`, `DealForm`, `MeetingOutcome`, `CreateDealButton` | `src/app/(app)/pipeline/[id]/deal-client.tsx` | Deal workspace |
| `TaskItem`, `NewTaskButton` | `src/components/app/task-list.tsx` | Task rows and creation dialog |
| `Timeline` | `src/components/app/timeline.tsx` | Activity timeline |
| `StatusBadge`, `ScoreBadge`, `TempBadge`, `DispositionBadge` | `src/components/app/lead-badges.tsx` | Status language |
| `LiveRefresh` | `src/components/app/live-refresh.tsx` | 30 s auto refresh (Sales Floor) |
| `PeriodTabs`, `Delta` | `src/components/app/period.tsx` | Period switcher and change indicator |
| `Field`, `Input`, `Select`, `SubmitButton`, `FormAlert` | `src/components/app/form.tsx` | Form controls |
| `Logo`, `LogoMark` | `src/components/app/logo.tsx` | Phoonica logo (inline SVG) |
| `ColumnChart`, `BarList` | `src/components/charts/bars.tsx` | Charts |
| `PageHeader`, `Card`, `IconTile`, `Panel`, `Badge`, `Dot`, `Button`, `buttonClass`, `ButtonLink`, `IconButton`, `Metric`, `EmptyState`, `Tabs`, `thClass`, `tdClass` | `src/components/ui/index.tsx` | Design-system primitives |
| `Dialog` | `src/components/ui/dialog.tsx` | Accessible modal |
| `ToastProvider`, `useToast` | `src/components/ui/toast.tsx` | Toasts |
| `Link` | `src/components/ui/link.tsx` | Link with prefetch off by default |

Design tokens: `src/app/globals.css` (see the table in `docs/ARCHITECTURE.md#design-system`). Assets: the logo is an
inline SVG component; `src/app/favicon.ico` is the only binary asset; icons come from `lucide-react`; the Inter font is
loaded by `next/font`. There are no image files.

## File inventory

### Root configuration

| File | Purpose |
|---|---|
| `package.json` | Scripts and dependencies |
| `package-lock.json` | Exact dependency versions (use `npm ci`) |
| `tsconfig.json` | TypeScript config, `@/*` → `src/*` alias |
| `next.config.ts` | PGlite external package, `/team` redirect, security headers |
| `drizzle.config.ts` | drizzle-kit: schema path, `drizzle/` output |
| `postcss.config.mjs` | Tailwind v4 PostCSS plugin |
| `eslint.config.mjs` | ESLint (next core-web-vitals + TypeScript) |
| `playwright.config.ts` | E2E config (`BASE_URL`, `PW_CHROMIUM`) |
| `.env.example` | Environment variable template |
| `.gitignore` | Ignores node_modules, .next, .data, test output, local helper scripts, screenshots |
| `README.md` | Quick start, scripts, production, keyboard, providers |
| `SETUP.md` | Full handover / setup guide |
| `INVENTORY.md` | This file |
| `docs/ARCHITECTURE.md` | Layers, data model, write path, seed, decisions, design system |

### Database and migrations

| File | Purpose |
|---|---|
| `src/lib/db/schema.ts` | Drizzle tables and enums |
| `src/lib/db/index.ts` | `getDb` / `closeDb`: PGlite or node-postgres, auto-migrate, auto-seed |
| `src/lib/db/seed.ts` | Demo org, accounts, default stages, simulated history; `seedDemo`, `seedIfEmpty`, `resetDemoData`, `createDefaultStages` |
| `drizzle/0000_init.sql` | Initial migration (all tables, enums, indexes, FKs) |
| `drizzle/meta/_journal.json`, `drizzle/meta/0000_snapshot.json` | drizzle-kit migration metadata |
| `scripts/db.ts` | CLI: migrate / seed / reset / stats |

### Domain engine (`src/lib/domain`)

| File | Purpose |
|---|---|
| `dispositions.ts` | Outcomes, lead statuses, `planDisposition` (status + next action + cadence + intents), not-interested reasons, max attempts |
| `scoring.ts` | `scoreLead`, `scoreTier`, lead sources |
| `queue.ts` | `rankLead`, `rankQueue`, `isDue` with reasons |
| `outcome.ts` | `buildCallOutcome`, `rescore`, `estimateDealValue` |
| `time.ts` | Calling hours, business days, zoned dates, local labels, input parsing |

### Services (`src/lib/services`)

| File | Purpose |
|---|---|
| `context.ts` | `Ctx` (org, user, role), `canWorkLead`, members, campaigns, workspaces |
| `errors.ts` | `UserError`, `userMessage` |
| `desk.ts` | `getQueue` for the Calling Desk and badges |
| `calls.ts` | `startCall`, `endCall`, `activeCall`, `logCallOutcome`, `todayStats` |
| `leads.ts` | List/filter/count leads, detail, timeline, assign, status, notes, contact edit, ICP, global search |
| `companies.ts` | Company list, industries, company detail |
| `tasks.ts` | Task buckets, counts, complete / reopen / reschedule / create |
| `deals.ts` | Stages, board, summary, deal detail, move stage, update, create from lead, meeting outcome |
| `analytics.ts` | KPIs, rep table, daily series, dispositions, connect by local hour, segments, loss reasons, attention items, recent calls, open pipeline |
| `settings.ts` | Workspace, members, profile, reset / clear data, counts |
| `badges.ts` | Nav badge counts |
| `notifications.ts` | Shell notifications |

### Auth

| File | Purpose |
|---|---|
| `src/lib/auth/password.ts` | scrypt hash / verify |
| `src/lib/auth/token.ts` | Cookie name, TTL, HMAC sign / verify (Edge-safe) |
| `src/lib/auth/session.ts` | `getSession`, `requireSession`, `requireManager`, `startSession`, `endSession` |
| `src/lib/auth/throttle.ts` | In-memory failed-login throttle |
| `src/middleware.ts` | Route protection |
| `src/app/(auth)/actions.ts` | Login / signup / logout actions |
| `src/app/(auth)/layout.tsx` | Auth page layout |
| `src/app/(auth)/login/page.tsx`, `login-form.tsx` | Login page and form with demo seats |
| `src/app/(auth)/signup/page.tsx` | Signup page |
| `src/app/auth/signout/route.ts` | Sign-out route |

### Providers

| File | Purpose |
|---|---|
| `src/lib/providers/types.ts` | Provider interfaces |
| `src/lib/providers/demo.ts` | Demo implementations (incl. rules-based AI call prep) |
| `src/lib/providers/index.ts` | Registry, env selection, `providerStatus` |

### Utilities

| File | Purpose |
|---|---|
| `src/lib/format.ts` | Phone, duration, relative time, date-time, money, percent, initials formatting |
| `src/lib/period.ts` | Analytics / Sales Floor period presets |
| `src/lib/utils/index.ts` | `cn` and generic date / number / math helpers |

### App pages and actions (`src/app`)

| File | Purpose |
|---|---|
| `layout.tsx`, `globals.css`, `not-found.tsx`, `favicon.ico` | Root layout, design tokens, 404, icon |
| `(app)/layout.tsx` | Signed-in layout: session, org, workspaces, badges, notifications → `AppShell` |
| `(app)/page.tsx` | Redirect to desk |
| `(app)/loading.tsx`, `(app)/error.tsx` | Loading and error boundaries |
| `(app)/actions.ts` | Search and workspace switch |
| `(app)/desk/page.tsx`, `desk.tsx`, `actions.ts` | Calling Desk server page, client cockpit, call actions |
| `(app)/leads/page.tsx`, `filters.tsx`, `lead-table.tsx`, `actions.ts` | Lead database |
| `(app)/leads/[id]/page.tsx`, `lead-client.tsx` | Lead detail |
| `(app)/companies/page.tsx`, `filters.tsx`, `[id]/page.tsx` | Companies |
| `(app)/tasks/page.tsx`, `assignee-filter.tsx`, `actions.ts` | Tasks |
| `(app)/pipeline/page.tsx`, `board.tsx`, `owner-filter.tsx`, `actions.ts` | Pipeline board |
| `(app)/pipeline/[id]/page.tsx`, `deal-client.tsx` | Deal workspace |
| `(app)/sales-floor/page.tsx`, `assign-inline.tsx` | Sales Floor |
| `(app)/analytics/page.tsx`, `rep-filter.tsx` | Analytics |
| `(app)/settings/page.tsx`, `forms.tsx`, `actions.ts` | Settings |

### Tests

| File | Purpose |
|---|---|
| `tests/domain.test.ts` | 15 unit tests: dispositions / cadence, scoring, queue ranking, time zones |
| `e2e/helpers.ts` | Demo password and `login` helper |
| `e2e/auth.spec.ts` | Login, logout, protected routes |
| `e2e/leads.spec.ts` | Lead list, filters, lead detail |
| `e2e/desk.spec.ts` | Call → outcome → follow-up flow on the desk |
| `e2e/pipeline.spec.ts` | Deal stage moves, deal page |
| `e2e/manager.spec.ts` | Sales Floor, assignment, analytics, settings as manager/owner |

## Extras (ZIP only)

| Path | Purpose |
|---|---|
| `extras/lead-desk-artifact/phoonica-desk.html` | Separate single-file Phoonica Lead Desk built for the "East Coast Website Leads (100)" spreadsheet (claude.ai Artifact; uses the artifact `db` and `downloads` capabilities). See SETUP.md section 17 |
| `extras/lead-desk-artifact/seed/L001.json … L100.json` | The 100 leads loaded into that artifact |
