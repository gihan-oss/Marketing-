# Social automation — LinkedIn / Instagram / Facebook

This platform reads published social posts and their engagement from the
**Social Posts** table in the *Amal & Company Marketing* Airtable base
(`tblJ4ILxjD1yTG7ef`) and shows them on the **Published Posts** page. That
table is filled by an automation in **Make.com** — the platform never talks to
the social networks directly (those require your account's authorization).

## Phase 1 (this PR): pull posted content + metrics — read-only

```
LinkedIn / Instagram Business / Facebook Page
        │  (Make connectors, authorized by you)
        ▼
   Make.com scenario  ──►  Airtable "Social Posts" (upsert by External ID)
                                   │
                                   ▼
                     Published Posts page in the dashboard
```

### One-time setup (only you can do these — they need your logins)

1. **Make → Connections**
   - Reconnect **Airtable** (the existing connection's token has expired).
   - Add **Facebook Pages**, **Instagram for Business**, and **LinkedIn**
     connections (Make walks you through each OAuth).
2. **Account types the platforms require**
   - Facebook: a **Page** you administer (not a personal profile).
   - Instagram: a **Business/Creator** account linked to that Page.
   - LinkedIn: your profile and/or a **Company Page** you administer.
3. **Plan** — the Free plan allows 2 scenarios / 1,000 ops / 15-min polling.
   A daily metrics sync across 3 channels fits, but headroom is tight; a paid
   tier is recommended once publishing (Phase 2) is added.

### The scenario (built once connections exist)

One scheduled scenario (daily is plenty), with a branch per channel:

| Step | Module | Notes |
| --- | --- | --- |
| Trigger | Schedule | Once daily (Free-plan safe) |
| LinkedIn | *Get posts* + *Get post statistics* | Own profile / admin'd Company Page |
| Instagram | *Get media* + *Get media insights* | IG Business account |
| Facebook | *Get Page posts* + *Get post insights* | Page you administer |
| Write | Airtable *Upsert a record* into **Social Posts**, matched on **External ID** | Prevents duplicates; refreshes metrics on existing rows |

### Field mapping (platform → Social Posts)

| Social Posts field | LinkedIn | Instagram | Facebook |
| --- | --- | --- | --- |
| Caption | commentary/text | caption | message |
| Channel | `LinkedIn` | `Instagram` | `Facebook` |
| Post Type | article/image/… | IMAGE/VIDEO/REEL/CAROUSEL | status/photo/video |
| Published | created time | timestamp | created_time |
| Permalink | post URL | permalink | permalink_url |
| Media URL | thumbnail | media_url / thumbnail_url | full_picture |
| Likes | likeCount | like_count | reactions |
| Comments | commentCount | comments_count | comments |
| Shares | shareCount | — | shares |
| Reach | impressionCount* | reach (insight) | post_impressions_unique |
| Impressions | impressionCount | impressions (insight) | post_impressions |
| External ID | post URN | media id | post id |
| Last Synced | now() | now() | now() |

\* LinkedIn exposes impressions on organization posts; personal-post metrics
are more limited.

## Phase 2 (later): publish/schedule from Airtable

When a **Content** row is marked *Approved / Scheduled*, a second scenario
publishes it to the chosen channel on its post date and writes the resulting
post back into **Social Posts** (closing the loop with Phase 1). This needs
publish permissions and careful testing, and will likely require a Make paid
tier — tackled after Phase 1 is verified with live data.
