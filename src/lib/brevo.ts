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

export interface BrevoTemplateDetail {
  id: number;
  name: string;
  subject: string;
  htmlContent: string;
}

/** Fetch one template including its rendered HTML body (for preview). */
export async function getTemplate(id: number): Promise<BrevoTemplateDetail> {
  const t = (await brevo(`/smtp/templates/${id}`)) as {
    id: number;
    name: string;
    subject: string;
    htmlContent: string;
  };
  return { id: t.id, name: t.name, subject: t.subject, htmlContent: t.htmlContent };
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
/**
 * Create (or refresh) a transactional template in Brevo from raw HTML, so a
 * design built in the Email Studio becomes selectable in the outreach
 * composer. Returns the new template's id.
 */
export async function createBrevoTemplate(opts: {
  name: string;
  subject: string;
  html: string;
}): Promise<number> {
  const body = (await brevo("/smtp/templates", {
    method: "POST",
    body: JSON.stringify({
      templateName: opts.name,
      subject: opts.subject,
      htmlContent: opts.html,
      isActive: true,
      sender: { email: "gihan@amalandcompany.com", name: "Amal & Company" },
      replyTo: "gihan@amalandcompany.com",
      tag: "studio",
    }),
  })) as { id: number };
  return body.id;
}

/**
 * Send a one-off HTML email (no template) — used for internal mails like
 * sending a content script to the CEO for approval.
 */
export async function sendHtmlEmail(opts: {
  email: string;
  subject: string;
  html: string;
  senderName?: string;
}): Promise<SendResult> {
  const { email, subject, html, senderName } = opts;
  try {
    const body = (await brevo("/smtp/email", {
      method: "POST",
      body: JSON.stringify({
        sender: { email: "gihan@amalandcompany.com", name: senderName ?? "Amal & Company Marketing" },
        to: [{ email }],
        subject,
        htmlContent: html,
      }),
    })) as { messageId?: string };
    return { email, ok: true, messageId: body?.messageId };
  } catch (err) {
    return { email, ok: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}

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
