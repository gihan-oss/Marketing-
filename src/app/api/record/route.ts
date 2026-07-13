import { NextResponse } from "next/server";
import { createRecord, invalidate, updateRecordField } from "@/lib/airtable";
import { AMAL_EDITABLE, BASE_ID, TABLES, type TableKey } from "@/lib/schema";
import { CLIENTS, type ClientKey, type ClientTableRole } from "@/lib/clients";

export const dynamic = "force-dynamic";

interface WriteBody {
  source: "amal" | ClientKey;
  /** Amal: TableKey. Client: ClientTableRole. */
  tableKey: string;
  recordId: string;
  fieldKey: string;
  value: string | number | null;
}

/**
 * Single-field write-back. Every mutation is resolved and authorized against
 * the schema registries server-side — the client can only touch fields that
 * are explicitly marked editable, on tables that exist. Nothing else is
 * writable, regardless of what the request asks for.
 */
export async function POST(request: Request) {
  if (!process.env.AIRTABLE_API_KEY) {
    return NextResponse.json({ error: "AIRTABLE_API_KEY is not configured" }, { status: 503 });
  }

  let body: WriteBody;
  try {
    body = (await request.json()) as WriteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { source, tableKey, recordId, fieldKey, value } = body;
  if (!recordId || !fieldKey) {
    return NextResponse.json({ error: "Missing recordId or fieldKey" }, { status: 400 });
  }

  let baseId: string;
  let tableId: string;
  let fieldName: string;
  let fieldType: string;

  if (source === "amal") {
    const table = TABLES[tableKey as TableKey];
    if (!table) return NextResponse.json({ error: "Unknown table" }, { status: 400 });
    if (!(AMAL_EDITABLE[tableKey as TableKey] ?? []).includes(fieldKey)) {
      return NextResponse.json({ error: "Field is not editable" }, { status: 403 });
    }
    const field = table.fields[fieldKey];
    if (!field) return NextResponse.json({ error: "Unknown field" }, { status: 400 });
    baseId = BASE_ID;
    tableId = table.id;
    fieldName = field.name;
    fieldType = field.type;
  } else if (source in CLIENTS) {
    const client = CLIENTS[source as ClientKey];
    const table = client.tables[tableKey as ClientTableRole];
    if (!table) return NextResponse.json({ error: "Unknown table" }, { status: 400 });
    const field = table.fields[fieldKey];
    if (!field) return NextResponse.json({ error: "Unknown field" }, { status: 400 });
    if (!field.editable) {
      return NextResponse.json({ error: "Field is not editable" }, { status: 403 });
    }
    baseId = client.baseId;
    tableId = table.id;
    fieldName = field.name;
    fieldType = field.type;
  } else {
    return NextResponse.json({ error: "Unknown source" }, { status: 400 });
  }

  // Coerce/normalize the value to the field's type.
  let out: string | number | null = value;
  if (value === "" || value === null || value === undefined) {
    out = null;
  } else if (fieldType === "number" || fieldType === "currency") {
    const n = Number(value);
    out = Number.isFinite(n) ? n : null;
  } else {
    out = String(value);
  }

  try {
    await updateRecordField(baseId, tableId, recordId, fieldName, out);
    invalidate(source === "amal" ? undefined : (source as ClientKey));
    return NextResponse.json({ ok: true, value: out });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Write failed" },
      { status: 502 }
    );
  }
}

interface CreateBody {
  tableKey: TableKey;
  fields: Record<string, string | number | null>;
}

/**
 * Create a record on the marketing base. Authorized against the same
 * editable-field allowlist as updates — only allowlisted fields on known
 * tables can be set, so the dashboard can create (e.g.) new Content ideas
 * but nothing outside that surface.
 */
export async function PUT(request: Request) {
  if (!process.env.AIRTABLE_API_KEY) {
    return NextResponse.json({ error: "AIRTABLE_API_KEY is not configured" }, { status: 503 });
  }
  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const table = TABLES[body.tableKey];
  if (!table) return NextResponse.json({ error: "Unknown table" }, { status: 400 });
  const allow = AMAL_EDITABLE[body.tableKey] ?? [];
  if (allow.length === 0) {
    return NextResponse.json({ error: "Table does not allow creation" }, { status: 403 });
  }

  const out: Record<string, string | number | null> = {};
  for (const [fieldKey, value] of Object.entries(body.fields ?? {})) {
    if (!allow.includes(fieldKey)) continue; // silently drop non-editable fields
    const def = table.fields[fieldKey];
    if (!def || value === "" || value == null) continue;
    out[def.name] =
      def.type === "number" || def.type === "currency" ? Number(value) : String(value);
  }
  if (Object.keys(out).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  try {
    const id = await createRecord(BASE_ID, table.id, out);
    invalidate();
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create failed" },
      { status: 502 }
    );
  }
}
