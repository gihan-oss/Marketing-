import "server-only";

/**
 * Brevo (email) server-side client. Used by the outreach send/schedule
 * actions. Requires BREVO_API_KEY in the environment; when it's absent the
 * API routes return a 503 and the UI shows a setup notice — no email is ever
 * sent without an explicit user action in the composer.
 */

const API_ROOT = "https://api.brevo.com/v3";

export interface BrevoTemplate {
  id: number;
  name: string;
  subject: string;
  isActive: boolean;
}

export function brevoConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY);
}

async function brevo(path: string, init?: RequestInit) {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error("BREVO_API_KEY is not configured");
  const res = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      "api-key": key,
      "content-type": "application/json",
      accept: "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

export async function listTemplates(): Promise<BrevoTemplate[]> {
  const body = (await brevo("/smtp/templates?templateStatus=true&limit=100&sort=desc")) as {
    templates?: { id: number; name: string; subject: string; isActive: boolean }[];
  };
  return (body.templates ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    subject: t.subject,
    isActive: t.isActive,
  }));
}

/** Ensure the recipient exists as a contact with FIRSTNAME so templates that
 *  reference {{ contact.FIRSTNAME }} personalize correctly. Best-effort. */
async function upsertContact(email: string, firstName?: string, lastName?: string) {
  try {
    await brevo("/contacts", {
      method: "POST",
      body: JSON.stringify({
        email,
        updateEnabled: true,
        attributes: {
          ...(firstName ? { FIRSTNAME: firstName } : {}),
          ...(lastName ? { LASTNAME: lastName } : {}),
        },
      }),
    });
  } catch {
    // Non-fatal: the send still works, personalization falls back to default.
  }
}

export interface SendResult {
  email: string;
  ok: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send (or schedule) one templated email. `scheduledAt` is an ISO-8601 string
 * with timezone offset; omit to send immediately.
 */
export async function sendTemplateEmail(opts: {
  templateId: number;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  scheduledAt?: string;
}): Promise<SendResult> {
  const { templateId, email, name, firstName, lastName, scheduledAt } = opts;
  try {
    await upsertContact(email, firstName, lastName);
    const payload: Record<string, unknown> = {
      templateId,
      to: [{ email, ...(name ? { name } : {}) }],
      params: { FIRSTNAME: firstName ?? "there" },
    };
    if (scheduledAt) payload.scheduledAt = scheduledAt;
    const body = (await brevo("/smtp/email", {
      method: "POST",
      body: JSON.stringify(payload),
    })) as { messageId?: string };
    return { email, ok: true, messageId: body?.messageId };
  } catch (err) {
    return { email, ok: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}
