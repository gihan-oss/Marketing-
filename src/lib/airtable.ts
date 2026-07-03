import "server-only";
import { BASE_ID, TABLES, TABLE_KEYS, type TableKey } from "./schema";
import type { Rec, Snapshot } from "./types";

/**
 * Server-side Airtable REST client.
 *
 * All reads go through fetchSnapshot(), which pulls every table in parallel
 * and caches the result in-process for CACHE_TTL_MS. The data volumes in this
 * base are small (tens–hundreds of rows), so a full snapshot keeps every page
 * and filter instantly consistent without per-widget API calls.
 */

const API_ROOT = "https://api.airtable.com/v0";
const CACHE_TTL_MS = 60_000;

interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

let cache: { at: number; snapshot: Snapshot } | null = null;
let inflight: Promise<Snapshot> | null = null;

function normalizeValue(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  // singleSelect comes back as a name string via the REST API, but guard for
  // object shapes ({name}) and arrays (collaborators, lookups, attachments).
  if (Array.isArray(v)) {
    return v
      .map((item) =>
        typeof item === "string" || typeof item === "number"
          ? String(item)
          : item && typeof item === "object" && "name" in item
            ? String((item as { name: unknown }).name)
            : ""
      )
      .filter(Boolean)
      .join(", ");
  }
  if (typeof v === "object" && v !== null && "name" in v) {
    return String((v as { name: unknown }).name);
  }
  return null;
}

async function fetchTable(apiKey: string, key: TableKey): Promise<Rec[]> {
  const table = TABLES[key];
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`${API_ROOT}/${BASE_ID}/${table.id}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Airtable ${res.status} on ${table.name}: ${await res.text()}`);
    }
    const body = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...body.records);
    offset = body.offset;
  } while (offset);

  return records.map((r) => {
    const fields: Rec["fields"] = {};
    for (const [fieldKey, def] of Object.entries(table.fields)) {
      fields[fieldKey] = normalizeValue(r.fields[def.name]);
    }
    const primary = Object.entries(table.fields).find(([, d]) => d.name === table.primaryField);
    const label =
      (primary && fields[primary[0]] != null && String(fields[primary[0]])) ||
      normalizeValue(r.fields[table.primaryField])?.toString() ||
      r.id;
    return { id: r.id, table: key, createdTime: r.createdTime, label: String(label), fields };
  });
}

export async function fetchSnapshot(force = false): Promise<Snapshot> {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    return {
      fetchedAt: new Date().toISOString(),
      unconfigured: true,
      tables: emptyTables(),
    };
  }

  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.snapshot;
  if (!force && inflight) return inflight;

  inflight = (async () => {
    try {
      const results = await Promise.all(TABLE_KEYS.map((k) => fetchTable(apiKey, k)));
      const tables = emptyTables();
      TABLE_KEYS.forEach((k, i) => {
        tables[k] = results[i];
      });
      const snapshot: Snapshot = { fetchedAt: new Date().toISOString(), tables };
      cache = { at: Date.now(), snapshot };
      return snapshot;
    } catch (err) {
      // Serve the last good snapshot on transient failures.
      if (cache) return cache.snapshot;
      return {
        fetchedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : "Failed to reach Airtable",
        tables: emptyTables(),
      };
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

function emptyTables(): Snapshot["tables"] {
  return Object.fromEntries(TABLE_KEYS.map((k) => [k, []])) as unknown as Snapshot["tables"];
}
