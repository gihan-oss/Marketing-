# Social automation — LinkedIn / Instagram / Facebook

This platform now ships a **built-in social automation engine** that syncs
published posts and their engagement from LinkedIn / Instagram / Facebook into
the **Social Posts** table (`tblJ4ILxjD1yTG7ef`) of the *Amal & Company
Marketing* base, and — when explicitly enabled — publishes approved,
scheduled **Content** rows back out to a channel. The **Published Posts** page
reads that table.

```
LinkedIn / Instagram Business / Facebook Page
        │  official Graph / REST APIs (server-side tokens)
        ▼
   src/lib/social  ── engine (fetch → normalize → upsert; retries; logging)
        │                     ▲
        │                     │  Vercel Cron (daily) or "Sync now" button
        ▼                     │
   Airtable "Social Posts" ───┘  (upsert by External ID — idempotent)
        │
        ▼
   Published Posts page + /api/social/status
```

The engine talks to the platforms directly with server-side tokens rather than
routing through a no-code tool, so scheduling, retries, error isolation, and
logging all live in the codebase and are testable. (A Make.com scenario, shown
at the bottom, remains a valid no-code alternative if you prefer not to hold
tokens on the server.)

## Architecture

| File | Role |
| --- | --- |
| `src/lib/social/core.ts` | Types, retry-with-backoff, structured logging, run-report ring buffer |
| `src/lib/social/providers.ts` | LinkedIn / Instagram / Facebook API clients (each gated on its own env credentials) |
| `src/lib/social/airtable.ts` | Idempotent upsert into Social Posts (keyed on External ID); Content publish queue |
| `src/lib/social/index.ts` | `syncSocialMetrics()`, `publishScheduledContent()`, `automationStatus()`, endpoint auth |
| `src/app/api/social/sync` | Phase 1 trigger (Cron GET / manual POST) |
| `src/app/api/social/publish` | Phase 2 trigger (Cron GET / manual POST) |
| `src/app/api/social/status` | Config + last-run status for the dashboard |

### Principles

- **Env-gated & graceful.** A channel activates only when its credentials are
  present; a missing channel is skipped, never erroring. With nothing
  configured the page shows a setup notice — no placeholder data.
- **Idempotent.** Posts upsert by **External ID**, so re-running only refreshes
  metrics; it never duplicates rows.
- **Failure-isolated.** One channel's (or one post's) failure is caught, logged,
  and reported — it never aborts the rest of the run.
- **Resilient.** Every outbound call is wrapped in exponential-backoff retries
  for transient (429 / 5xx) responses.
- **Safe by default.** Publishing (Phase 2) is off unless `SOCIAL_PUBLISH_ENABLED=true`.

## Phase 1 — metrics sync (read-only)

`GET/POST /api/social/sync` → `syncSocialMetrics()`:

1. For each configured channel, fetch recent posts + engagement.
2. Normalize to Social Posts fields (mapping below).
3. Upsert into Airtable in batches, matched on External ID.
4. Return a per-channel run report (fetched / created / updated / errors).

Scheduled daily by Vercel Cron (`vercel.json`), and runnable on demand from the
**Sync now** button on the Published Posts page.

### Field mapping (platform → Social Posts)

| Social Posts field | LinkedIn | Instagram | Facebook |
| --- | --- | --- | --- |
| Caption | commentary | caption | message |
| Channel | `LinkedIn` | `Instagram` | `Facebook` |
| Post Type | image/text | IMAGE/VIDEO/REEL/CAROUSEL/STORY | photo/video/link/status |
| Published | createdAt | timestamp | created_time |
| Permalink | feed update URL | permalink | permalink_url |
| Media URL | — | media_url / thumbnail_url | full_picture |
| Likes | socialActions likes | like_count | reactions.total_count |
| Comments | socialActions comments | comments_count | comments.total_count |
| Shares | — | — | shares.count |
| Reach | impressions | reach (insight) | post_impressions_unique |
| Impressions | impressions | impressions (insight) | post_impressions |
| External ID | post URN | media id | post id |
| Last Synced | now() | now() | now() |

## Phase 2 — publish scheduled content (opt-in)

`GET/POST /api/social/publish` → `publishScheduledContent()`:

1. Requires `SOCIAL_PUBLISH_ENABLED=true` and a `SOCIAL_DEFAULT_PUBLISH_CHANNEL`.
2. Reads **Content** rows whose Status is *"Scheduled to be published"* and
   whose Post Date is now due.
3. Publishes each to the default channel, writes the resulting post into
   **Social Posts** (closing the loop with Phase 1), and only then advances the
   Content Status to *"Published"* — so a failed publish safely retries next run.

> The Content table has no per-row channel/media fields, so publishing uses the
> post idea text as the caption and a single default channel. Adding a
> "Channel" (and "Media URL") field to Content would enable per-row,
> multi-channel targeting — the provider layer already accepts both.

## Configuration

All credentials are optional and documented in `.env.example`:

- `CRON_SECRET` — protects the trigger endpoints (Cron sends it as a Bearer
  token; the in-app button is allowed same-origin). Always set in production.
- LinkedIn: `LINKEDIN_ACCESS_TOKEN`, `LINKEDIN_AUTHOR_URN`
- Instagram: `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID`
- Facebook: `FACEBOOK_PAGE_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID`
- Publishing: `SOCIAL_PUBLISH_ENABLED`, `SOCIAL_DEFAULT_PUBLISH_CHANNEL`

Account requirements: Facebook needs a **Page** you administer; Instagram a
**Business/Creator** account linked to that Page; LinkedIn your profile and/or a
**Company Page** you administer. Token scopes must include read access to posts
and insights (and publish scopes for Phase 2).

### Scheduling & scalability

- Cron cadence lives in `vercel.json`. The daily schedule is Hobby-plan safe;
  on a paid plan you can raise the publish frequency for tighter scheduling.
- Snapshots are small (tens–hundreds of rows); upserts batch at Airtable's
  10-records-per-request limit and paginate reads. If volume grows, the
  per-channel providers can be moved behind a queue without touching the engine
  or the dashboard.

## Alternative: Make.com (no-code)

If you would rather not store platform tokens on the server, a Make.com scenario
can perform the same Phase 1 upsert:

| Step | Module | Notes |
| --- | --- | --- |
| Trigger | Schedule | Once daily |
| LinkedIn | *Get posts* + *Get post statistics* | Own profile / admin'd Company Page |
| Instagram | *Get media* + *Get media insights* | IG Business account |
| Facebook | *Get Page posts* + *Get post insights* | Page you administer |
| Write | Airtable *Upsert a record* into **Social Posts**, matched on **External ID** | Prevents duplicates; refreshes metrics |

Because both paths write the same table keyed on External ID, you can use either
(or migrate between them) without changing the dashboard.
