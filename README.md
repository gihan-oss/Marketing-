# Amal & Company — Marketing Analytics Platform

A unified executive analytics platform for the **Amal & Company Marketing** workspace. One
application replaces scattered per-table views with a single command center backed live by
Airtable — no hardcoded values, no mock data, no placeholder statistics.

## What the audit found (and how this platform responds)

Before building, the workspace was audited:

- **This repository was empty** — there was no existing application code to merge or migrate.
- **The workspace's real data lives in Airtable**, in the *Amal & Company Marketing* base
  (`appcDlJ12Cje9tUSG`): Sales Pipeline, Prospects, Webinars, Content, Branding Campaigns,
  Marketing Strategy, and People.
- **That base has no Airtable interfaces/dashboards** — metrics existed only as raw tables,
  with no shared filters, no KPI definitions, and no drill-downs.
- Table/field IDs and every select option were captured from the live schema into
  [`src/lib/schema.ts`](src/lib/schema.ts), which is the platform's single data-model registry.

This app is therefore the workspace's **first and only** dashboard layer, designed so future
views are added here rather than as parallel one-off dashboards.

## Architecture

```
Airtable (live base)
   │  REST API, server-side only (token never reaches the browser)
   ▼
src/lib/airtable.ts     — snapshot fetcher: all tables in parallel, 60s in-process cache,
   │                      serves last-good data on transient failures
   ▼
/api/snapshot           — one JSON payload the whole client consumes
   │
   ▼
DataProvider (client)   — global filters (URL-synced), drill-down state, theme
   │
   ├─ src/lib/filters.ts — one Filters object applied uniformly to every table
   ├─ src/lib/metrics.ts — the METRIC ENGINE: every KPI computed from filtered records,
   │                       each result carries its formula + the exact source records
   └─ pages/components   — Command Center, Pipeline, Outreach, Webinars,
                           Content & Campaigns, Data Explorer

/api/assistant          — Claude (claude-opus-4-8, streaming, adaptive thinking) grounded
                          in the same filtered snapshot + computed KPIs
```

### Principles

- **Data-first.** Every number on screen is computed by `computeExecutiveMetrics()` or a
  group-by over live records. There is not a single hardcoded statistic in the codebase.
- **Traceable.** Every KPI tile and chart mark opens a drawer showing the calculation
  formula and the source records, each deep-linking to its Airtable record.
- **Cross-filtered.** Segment / Region / Source / Owner / date range / search live in the
  URL and apply to every page, chart, table, and the AI assistant simultaneously.
- **One design system.** Token-driven CSS with full light/dark theming; chart colors come
  from a CVD-validated palette with fixed categorical hue order.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Command Center — cross-domain executive KPIs, pipeline funnel, segment mix, growth trends |
| `/pipeline` | Sales pipeline: stage funnel, sources, win rate, overdue next actions, all deals |
| `/prospects` | Outreach: pool size, deliverability, reply rate, outreach funnel, segments/regions |
| `/webinars` | Webinar program: delivery status, series coverage, registrations/attendance |
| `/content` | Content production pipeline, post-type mix, branding campaign workstreams |
| `/social` | Published Posts — live social engagement synced from LinkedIn/Instagram/Facebook |
| `/data` | Data Explorer: every source table with sorting, search, CSV export, record drill-down |
| `/clients/mas-gla` | MAS GLA delivery dashboard — Initiatives, Projects, Tasks, Check-Ins (live from the MAS GLA base) |
| `/clients/kasper` | Kasper delivery dashboard — same delivery spine, live from the Kasper base |

### Active client engagements

The **Active Clients** section surfaces per-client delivery dashboards for the two live
engagements (MAS GLA and Kasper), each reading from that client's *own* Airtable base
(declared in `src/lib/clients.ts`): task completion, delayed-task alerts, initiative and
project status, and the latest client check-in. Task workflow fields are inline-editable.

### Inline editing (write-back)

Workflow fields — status/stage, owner, dates, notes — can be edited directly from the
platform (in tables and the detail drawer); changes write back to Airtable via
`/api/record`. Every write is authorized server-side against an editable-field allowlist
(`AMAL_EDITABLE` in `src/lib/schema.ts` and the `editable` flags in `src/lib/clients.ts`),
so only whitelisted fields on known tables can ever be changed. Requires the token to have
the `data.records:write` scope.

### Social automation (LinkedIn / Instagram / Facebook)

A built-in engine (`src/lib/social/`) syncs published-post engagement from each
connected channel into the **Social Posts** table and can publish approved,
scheduled **Content** rows back out. It runs on a Vercel Cron schedule (and a
manual **Sync now** button), upserts idempotently by External ID, retries
transient failures, and isolates errors per channel. Every channel is env-gated
and optional; publishing is off unless explicitly enabled. Full setup and field
mapping: [`docs/social-automation.md`](docs/social-automation.md).

## Features

- Clickable KPIs with universal drill-down (formula → source records → Airtable deep link)
- Global cross-filtering synced to the URL (shareable filtered views)
- Interactive charts (funnel, bars, donut, trend) — every mark drills to its records
- Enterprise tables: sorting, search, CSV export, row detail
- Executive AI assistant (⌘J): explains KPIs, detects anomalies, writes summaries — grounded
  in the same live, filtered snapshot the dashboards use; streams responses
- Light/dark/system theme, skeleton loaders, empty states, error states, keyboard shortcuts,
  responsive layout, WCAG-minded semantics (aria labels, focus rings, reduced motion)

## Setup

```bash
cp .env.example .env    # add AIRTABLE_API_KEY (and optionally ANTHROPIC_API_KEY)
npm install
npm run dev             # http://localhost:3000
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `AIRTABLE_API_KEY` | yes | Personal access token with `data.records:read` on the marketing base |
| `AIRTABLE_BASE_ID` | no | Defaults to `appcDlJ12Cje9tUSG` |
| `ANTHROPIC_API_KEY` | no | Enables the executive AI assistant |
| `BREVO_API_KEY` | no | Enables the outreach send/schedule composer |
| `EMAIL_ASSET_BASE_URL` | no | Public host for email template images (used by `npm run build:email`) |
| `CRON_SECRET` | no | Protects the social automation endpoints (set in production) |
| `LINKEDIN_*` / `INSTAGRAM_*` / `FACEBOOK_*` | no | Per-channel social automation credentials — see [`docs/social-automation.md`](docs/social-automation.md) |

Without `AIRTABLE_API_KEY` the app runs and shows a setup notice — it never falls back to
fake data.

## Extending

- **New metric:** add one entry in `src/lib/metrics.ts` — it automatically becomes a
  clickable, filterable, drill-down-able KPI wherever it's rendered.
- **New field/table:** declare it in `src/lib/schema.ts`; the snapshot fetcher, filters,
  tables, and drawers pick it up from the registry.
- **Field renamed in Airtable:** update the one `name` in the registry; IDs stay stable.
