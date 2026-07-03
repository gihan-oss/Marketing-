import { TABLES, type TableKey } from "./schema";
import type { Filters, Rec, Snapshot } from "./types";

/**
 * Global cross-filtering. One Filters object (serialized in the URL) is
 * applied uniformly to every table: date bounds hit each table's own date
 * field, dimension filters hit the matching field when the table has it,
 * and tables without the dimension pass through unfiltered.
 */

export const FILTER_KEYS = ["from", "to", "segment", "region", "source", "owner", "q"] as const;

export function filtersFromSearchParams(sp: URLSearchParams): Filters {
  const f: Filters = {};
  for (const k of FILTER_KEYS) {
    const v = sp.get(k);
    if (v) f[k] = v;
  }
  return f;
}

export function filtersToSearchParams(f: Filters): URLSearchParams {
  const sp = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    if (f[k]) sp.set(k, f[k]!);
  }
  return sp;
}

export function activeFilterCount(f: Filters): number {
  return FILTER_KEYS.filter((k) => Boolean(f[k])).length;
}

function recordDate(rec: Rec): string | null {
  const def = TABLES[rec.table];
  if (!def.dateField) return null;
  const entry = Object.entries(def.fields).find(([, d]) => d.name === def.dateField);
  if (!entry) return null;
  const v = rec.fields[entry[0]];
  return typeof v === "string" && v ? v : null;
}

function matchesDimension(rec: Rec, fieldKey: string, wanted?: string): boolean {
  if (!wanted) return true;
  const def = TABLES[rec.table];
  if (!(fieldKey in def.fields)) return true; // table has no such dimension → pass through
  return rec.fields[fieldKey] === wanted;
}

export function applyFilters(records: Rec[], f: Filters): Rec[] {
  return records.filter((rec) => {
    const date = recordDate(rec);
    if (f.from && date && date < f.from) return false;
    if (f.to && date && date > `${f.to}T23:59:59`) return false;
    if (!matchesDimension(rec, "segment", f.segment)) return false;
    if (!matchesDimension(rec, "region", f.region)) return false;
    if (!matchesDimension(rec, "source", f.source)) return false;
    if (!matchesDimension(rec, "owner", f.owner)) return false;
    if (f.q) {
      const q = f.q.toLowerCase();
      const hay = `${rec.label} ${Object.values(rec.fields).filter((v) => typeof v === "string").join(" ")}`;
      if (!hay.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export function filteredSnapshot(snapshot: Snapshot, f: Filters): Record<TableKey, Rec[]> {
  const out = {} as Record<TableKey, Rec[]>;
  for (const [key, records] of Object.entries(snapshot.tables)) {
    out[key as TableKey] = applyFilters(records, f);
  }
  return out;
}

/** Distinct values present in the data for a given dimension, across tables. */
export function dimensionValues(snapshot: Snapshot, fieldKey: string): string[] {
  const set = new Set<string>();
  for (const records of Object.values(snapshot.tables)) {
    for (const rec of records) {
      const def = TABLES[rec.table];
      if (!(fieldKey in def.fields)) continue;
      const v = rec.fields[fieldKey];
      if (typeof v === "string" && v) set.add(v);
    }
  }
  return [...set].sort();
}
