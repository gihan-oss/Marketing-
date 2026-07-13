import "server-only";
import type { EmailDesign } from "./emailTemplate";

/**
 * Supabase integration for the Email Studio: public image hosting (Storage)
 * and saved email designs (Postgres via PostgREST). Talked to over REST with
 * the service-role key — server-side only, never exposed to the browser.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. When absent, the Studio
 * shows a setup notice and nothing is uploaded or saved.
 */

const BUCKET = process.env.SUPABASE_EMAIL_BUCKET || "email-images";
const TABLE = "email_designs";

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function creds(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured");
  return { url: url.replace(/\/+$/, ""), key };
}

/** Upload image bytes to the public bucket, returning a permanent public URL. */
export async function uploadEmailImage(
  bytes: ArrayBuffer,
  contentType: string,
  filename: string
): Promise<string> {
  const { url, key } = creds();
  // Namespace by a caller-provided filename; caller ensures uniqueness.
  const path = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": contentType || "application/octet-stream",
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!res.ok) {
    throw new Error(`Supabase upload ${res.status}: ${await res.text()}`);
  }
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`;
}

interface DesignRow {
  id: string;
  name: string | null;
  eyebrow: string | null;
  headline: string | null;
  subhead: string | null;
  image_url: string | null;
  body: string | null;
  question: string | null;
  cta_text: string | null;
  cta_url: string | null;
  created_at: string;
}

function rowToDesign(r: DesignRow): EmailDesign {
  return {
    id: r.id,
    name: r.name ?? undefined,
    eyebrow: r.eyebrow ?? undefined,
    headline: r.headline ?? undefined,
    subhead: r.subhead ?? undefined,
    imageUrl: r.image_url ?? undefined,
    body: r.body ?? undefined,
    question: r.question ?? undefined,
    ctaText: r.cta_text ?? undefined,
    ctaUrl: r.cta_url ?? undefined,
    createdAt: r.created_at,
  };
}

async function rest(path: string, init?: RequestInit) {
  const { url, key } = creds();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/** All saved designs, newest first. */
export async function listDesigns(): Promise<EmailDesign[]> {
  const rows = (await rest(`${TABLE}?select=*&order=created_at.desc`)) as DesignRow[];
  return rows.map(rowToDesign);
}

/** Insert or update a design; returns the saved row. */
export async function saveDesign(d: EmailDesign): Promise<EmailDesign> {
  const payload = {
    name: d.name ?? null,
    eyebrow: d.eyebrow ?? null,
    headline: d.headline ?? null,
    subhead: d.subhead ?? null,
    image_url: d.imageUrl ?? null,
    body: d.body ?? null,
    question: d.question ?? null,
    cta_text: d.ctaText ?? null,
    cta_url: d.ctaUrl ?? null,
  };
  const rows = d.id
    ? ((await rest(`${TABLE}?id=eq.${encodeURIComponent(d.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
      })) as DesignRow[])
    : ((await rest(TABLE, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
      })) as DesignRow[]);
  return rowToDesign(rows[0]);
}
