# Phoonica

The calling-first sales workspace. Phoonica decides **who to call next and why**, makes logging a call a
one-keystroke job, and turns every outcome into the right next action automatically:

**Find lead → understand lead → call → log outcome → next action scheduled → follow up → qualify → close.**

**Stack:** Next.js 15 (App Router, server actions) · TypeScript · Tailwind CSS v4 · Postgres via Drizzle ORM
(embedded PGlite in development) · zod · Playwright

## Quick start

```bash
npm install
npm run dev            # http://localhost:3000
```

No setup needed: without `DATABASE_URL`, Phoonica runs on an embedded Postgres (PGlite, stored in `.data/`),
applies migrations and generates the **Brightline Field Software** demo workspace on first start: ~700 leads at
~420 companies with six weeks of simulated SDR activity. Sign in from the login page with one click:

| Seat | Email | Sees |
|---|---|---|
| Rep | `sam@brightline.demo` (also priya, marcus, elena) | Calling Desk, own leads, tasks, pipeline |
| Manager | `dana@brightline.demo` | + Team dashboard, assignment, everyone's data |
| Owner | `jordan@brightline.demo` | + member management, data reset |

Password for all demo seats: `phoonica-demo`. Or sign up to create an empty workspace (optionally with sample data).

## Scripts

```bash
npm run typecheck && npm run lint
npm test               # domain unit tests (cadence, scoring, queue ranking, timezones)
npx playwright test    # end-to-end workflows against a running server (set PW_CHROMIUM to use a local Chromium)
npm run build && npm start

npm run db -- reset    # wipe the embedded dev DB and regenerate the demo workspace (stop `npm run dev` first)
npm run db -- seed     # seed an empty database (works with DATABASE_URL too)
npm run db -- stats
npm run db:generate    # generate a migration after editing src/lib/db/schema.ts
```

## Production

1. Provision Postgres (Supabase, Neon, RDS…) and set `DATABASE_URL`. Migrations in `drizzle/` run automatically
   on first connection. Seed a demo workspace with `npm run db -- seed` if you want one.
2. Set `AUTH_SECRET` to a long random string (required in production).
3. Optional: `DATABASE_POOL_MAX` (default 10), provider selection (see below).

## Keyboard

`?` lists every shortcut for the current page. Highlights: `⌘K` / `/` search · `g d` desk · `g l` leads ·
`g t` tasks · `g p` pipeline. On the desk: `C` call · `H` hang up · `1`–`0` outcome · `Enter` save & next ·
`N` notes · `S` skip. In lists: `J`/`K` move · `Enter` open · `C` call · `X` select.

## External services

Phone, email, AI, enrichment, calendar and SMS/WhatsApp go through provider interfaces in `src/lib/providers`.
Each ships a **demo** implementation that keeps the workflow usable and is labelled "Demo" in the UI. The demo
dialer does not place real calls: reps dial from their own phone and log the outcome in Phoonica. To connect a real
service, implement the interface, register it in `src/lib/providers/index.ts` and set e.g. `PHONE_PROVIDER=twilio`.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data model, rules engine and design decisions.
