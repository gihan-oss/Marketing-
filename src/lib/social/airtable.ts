import "server-only";
import { BASE_ID, TABLES } from "@/lib/schema";
import { withRetry, isTransientStatus, type PlatformPost } from "./core";

/**
 * Airtable write/read helpers scoped to social automation: idempotent upsert
 * of synced posts into "Social Posts" (keyed on External ID) and the Content
 * publish queue used by Phase 2. Kept separate from src/lib/airtable.ts (which
 * serves the read-only dashboard snapshot) so the automation's writes have a
 * small, auditable surface.
 */

const API_ROOT = "https://api.airtable.com/v0";
const SOCIAL = TABLES.social;
const CONTENT = TABLES.content;

function requireKey(): string {
  const key = process.env.AIRTABLE_API_KEY;
  if (!key) throw new Error("AIRTABLE_API_KEY is not configured");
  return key;
}

async function airtable(path: string, init?: RequestInit) {
  const key = requireKey();
  return withRetry(
    async () => {
      const res = await fetch(`${API_ROOT}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.text();
        const err = new Error(`Airtable ${res.status}: ${body}`) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      return res.status === 204 ? null : res.json();
    },
    {
      label: `airtable ${path}`,
      retryable: (e) => {
        const s = (e as { status?: number }).status;
        return s === undefined || isTransientStatus(s);
      },
    }
  );
}

interface AirtableRow {
  id: string;
  fields: Record<string, unknown>;
}

/** Fetch every Social Posts row, returning an External ID → record ID map. */
async function existingByExternalId(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const extField = SOCIAL.fields.externalId.name;
  let offset: string | undefined;
  do {
    const params = new URLSearchParams({ pageSize: "100" });
    // Only pull the key field back — we just need identity, not the payload.
    params.append("fields[]", extField);
    if (offset) params.set("offset", offset);
    const body = (await airtable(`/${BASE_ID}/${SOCIAL.id}?${params}`)) as {
      records: AirtableRow[];
      offset?: string;
    };
    for (const r of body.records) {
      const ext = r.fields[extField];
      if (typeof ext === "string" && ext) map.set(ext, r.id);
    }
    offset = body.offset;
  } while (offset);
  return map;
}

/** Map a normalized PlatformPost onto Airtable field names (skips undefined). */
function toFields(p: PlatformPost): Record<string, unknown> {
  const f = SOCIAL.fields;
  const out: Record<string, unknown> = {
    [f.channel.name]: p.channel,
    [f.externalId.name]: p.externalId,
    [f.lastSynced.name]: new Date().toISOString(),
  };
  const set = (name: string, v: unknown) => {
    if (v !== undefined && v !== null) out[name] = v;
  };
  set(f.caption.name, p.caption);
  set(f.postType.name, p.postType);
  set(f.published.name, p.published);
  set(f.permalink.name, p.permalink);
  set(f.mediaUrl.name, p.mediaUrl);
  set(f.likes.name, p.likes);
  set(f.comments.name, p.comments);
  set(f.shares.name, p.shares);
  set(f.reach.name, p.reach);
  set(f.impressions.name, p.impressions);
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export interface UpsertResult {
  created: number;
  updated: number;
}

/**
 * Upsert posts into Social Posts, matched on External ID. Existing rows are
 * PATCHed (metrics refreshed), new rows are POSTed. Writes go out in batches of
 * 10 (Airtable's per-request limit) with typecast so select options resolve by
 * name. Idempotent: re-running with the same posts only refreshes metrics.
 */
export async function upsertSocialPosts(posts: PlatformPost[]): Promise<UpsertResult> {
  if (posts.length === 0) return { created: 0, updated: 0 };
  const existing = await existingByExternalId();

  const toCreate: { fields: Record<string, unknown> }[] = [];
  const toUpdate: { id: string; fields: Record<string, unknown> }[] = [];
  // De-dupe within the batch so two rows never fight over the same External ID.
  const seen = new Set<string>();
  for (const p of posts) {
    if (!p.externalId || seen.has(p.externalId)) continue;
    seen.add(p.externalId);
    const fields = toFields(p);
    const id = existing.get(p.externalId);
    if (id) toUpdate.push({ id, fields });
    else toCreate.push({ fields });
  }

  for (const batch of chunk(toUpdate, 10)) {
    await airtable(`/${BASE_ID}/${SOCIAL.id}`, {
      method: "PATCH",
      body: JSON.stringify({ records: batch, typecast: true }),
    });
  }
  for (const batch of chunk(toCreate, 10)) {
    await airtable(`/${BASE_ID}/${SOCIAL.id}`, {
      method: "POST",
      body: JSON.stringify({ records: batch, typecast: true }),
    });
  }
  return { created: toCreate.length, updated: toUpdate.length };
}

// ---------------------------------------------------------------------------
// Content publish queue (Phase 2)
// ---------------------------------------------------------------------------

/** The Content status that marks a row ready to auto-publish. */
export const SCHEDULED_STATUS = "Scheduled to be published";
/** The Content status a row moves to once published. */
export const PUBLISHED_STATUS = "Published";

export interface ScheduledItem {
  id: string;
  caption: string;
  postType?: string;
  postDate?: string;
}

/**
 * Content rows marked "Scheduled to be published" whose Post Date is now due.
 * The Content table is small, so we fetch and filter in-process rather than
 * building a formula query.
 */
export async function listDueScheduledContent(now = new Date()): Promise<ScheduledItem[]> {
  const f = CONTENT.fields;
  const records: AirtableRow[] = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (offset) params.set("offset", offset);
    const body = (await airtable(`/${BASE_ID}/${CONTENT.id}?${params}`)) as {
      records: AirtableRow[];
      offset?: string;
    };
    records.push(...body.records);
    offset = body.offset;
  } while (offset);

  const due: ScheduledItem[] = [];
  for (const r of records) {
    if (r.fields[f.status.name] !== SCHEDULED_STATUS) continue;
    const rawDate = r.fields[f.postDate.name];
    const postDate = typeof rawDate === "string" ? rawDate : undefined;
    // No date → treat as due now; a future date defers publishing.
    if (postDate && new Date(postDate).getTime() > now.getTime()) continue;
    const caption = String(r.fields[f.postIdea.name] ?? "").trim();
    if (!caption) continue;
    const postType = r.fields[f.postType.name];
    due.push({
      id: r.id,
      caption,
      postType: typeof postType === "string" ? postType : undefined,
      postDate,
    });
  }
  return due;
}

/** Advance a Content row to "Published" after a successful publish. */
export async function markContentPublished(recordId: string): Promise<void> {
  await airtable(`/${BASE_ID}/${CONTENT.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      records: [{ id: recordId, fields: { [CONTENT.fields.status.name]: PUBLISHED_STATUS } }],
      typecast: true,
    }),
  });
}
