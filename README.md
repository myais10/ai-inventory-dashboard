# AI Inventory & Demand Intelligence

> Your ERP tells you what you have. We tell you what to do about it.

B2B SaaS for small and mid-sized parts & industrial distributors. It analyses inventory, sales, purchasing,
suppliers and customer enquiries and turns them into prioritised, explainable purchasing actions.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth + RLS) · Recharts

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

With no Supabase env vars the app runs in **demo mode**: sign in with any email/password to open the
**Northstar Industrial Supply** sample workspace, or sign up to go through onboarding and import CSVs
(sample files are available from the onboarding "Connect data" step).

```bash
npm run typecheck && npm run lint && npm run build
npm run inspect      # print engine output (KPIs, statuses, recommendations) for the sample dataset
```

## Connecting Supabase

1. Create a project, then apply `supabase/migrations/20261012000000_init.sql` (`supabase db push` or SQL editor).
2. Copy `.env.example` → `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. In Auth settings add `<site>/auth/callback` as a redirect URL (email confirmation + password reset).

Sign-up calls `create_company_for_current_user()` which atomically creates the company, owner membership,
7-day trial and a `subscriptions` row. All reads/writes run with the user's JWT, so RLS enforces tenancy.

## Architecture

```
src/lib/
  types/            Domain types (Dataset in → ProductMetrics / Recommendation out)
  forecasting/      Damped-trend exponential smoothing, seasonality + spike detection
  inventory/        Velocity, days of stock, safety stock, reorder point, projected stockout, excess
  suppliers/        Actual lead times, on-time rate, delays, price changes, dependency
  demand/           Demand series, movers, category demand, lost-demand aggregation
  recommendations/  Turns metrics into prioritised, explainable actions with $ impact
  ai/               EXPLANATION LAYER only: assistant + recommendation summaries built from engine output
  import/           CSV field definitions, auto-mapping, validation, Dataset builder (client + server)
  data/             Workspace resolver: sample data | demo in-memory tenant store | Supabase (RLS)
  auth/             Session (Supabase or signed demo cookie), roles & permissions
  mock/             Northstar Industrial Supply catalog + deterministic history generator
supabase/migrations Multi-tenant schema, composite tenant FKs, RLS policies, signup RPC
```

**Deterministic engine vs AI.** Every quantity, date and dollar figure is computed in `/lib/inventory`,
`/lib/forecasting`, `/lib/suppliers`, `/lib/demand` and `/lib/recommendations`. The `/lib/ai` layer only
restates engine output (`buildAssistantContext` is the grounded context to hand an LLM later).

Key formulas (`lib/inventory`):
- reorder point = forecast daily demand × effective lead time + safety stock (z = 1.65 × σ_weekly × √(LT/7))
- effective lead time = max(quoted, recent actual from received POs)
- reorder when inventory position ≤ ROP, or projected stockout within LT + 7 days;
  order-up-to = ROP + 28 days demand, rounded up to MOQ / order multiple
- stockout risk: day-by-day projection consuming forecast and receiving open POs;
  high = runs out before a new order could arrive
- excess = on hand above 26 weeks of forecast + safety stock; slow = 60+ days no sale; dead = 180+ days

## Multi-tenancy & security

- Every business table has `company_id`; composite foreign keys `(company_id, id)` prevent cross-tenant references.
- RLS: members read; owner/admin/manager write operational data; owner/admin manage settings and members;
  `subscriptions` is service-role write only (Stripe webhooks).
- Roles: Owner, Admin, Manager, Viewer (`lib/auth/permissions.ts`) are enforced in server actions as well.
- All inputs validated server-side with zod; CSV imports are re-validated on the server.
- Middleware protects every non-public route; no secrets reach the client.

## Not yet built (by design)

Stripe checkout (plans + `subscriptions` table ready), Excel import, ERP connectors (`integrations` table ready),
LLM-backed assistant (UI and grounded context ready), advanced forecasting models.
