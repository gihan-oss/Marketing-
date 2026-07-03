import type { TableKey } from "./schema";
import type { ClientKey, ClientTableRole } from "./clients";

/** A normalized Airtable record: field values keyed by the schema field key. */
export interface Rec {
  id: string;
  table: TableKey;
  createdTime: string;
  /** Display label taken from the table's primary field. */
  label: string;
  fields: Record<string, string | number | boolean | null>;
}

export type Snapshot = {
  fetchedAt: string;
  /** True when AIRTABLE_API_KEY is not configured — UI shows setup state. */
  unconfigured?: boolean;
  error?: string;
  tables: Record<TableKey, Rec[]>;
};

/** Global cross-filter state, shared by every page via the URL. */
export interface Filters {
  /** ISO date lower bound (inclusive) applied to each table's date field. */
  from?: string;
  /** ISO date upper bound (inclusive). */
  to?: string;
  segment?: string;
  region?: string;
  source?: string;
  owner?: string;
  /** Free-text search across primary fields. */
  q?: string;
}

/** A normalized record from a client base (keyed by ClientTableDef field keys). */
export interface ClientRec {
  id: string;
  role: ClientTableRole;
  /** Airtable table ID the record belongs to (for deep links + writes). */
  tableId: string;
  createdTime: string;
  label: string;
  fields: Record<string, string | number | boolean | null>;
}

export interface ClientSnapshot {
  fetchedAt: string;
  clientKey: ClientKey;
  unconfigured?: boolean;
  error?: string;
  tables: Partial<Record<ClientTableRole, ClientRec[]>>;
}

export interface MetricResult {
  id: string;
  label: string;
  /** Formatted display value. */
  value: string;
  /** Raw numeric value (null when the metric has no data under filters). */
  raw: number | null;
  /** Human-readable calculation, e.g. "sum of Deal Value where Stage ∈ won stages". */
  formula: string;
  /** Which table the metric is computed from. */
  table: TableKey;
  /** The records that produced the value — the drill-down set. */
  records: Rec[];
  /** Optional secondary line, e.g. "of 8 deals". */
  hint?: string;
  /** Status coloring for the tile. */
  tone?: "default" | "good" | "warning" | "critical";
}
