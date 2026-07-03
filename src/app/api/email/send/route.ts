import { NextResponse } from "next/server";
import { brevoConfigured, sendTemplateEmail } from "@/lib/brevo";
import { invalidate, updateRecordField } from "@/lib/airtable";
import { BASE_ID, TABLES } from "@/lib/schema";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Recipient {
  recordId?: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

interface SendBody {
  templateId: number;
  recipients: Recipient[];
  /** ISO-8601 with offset; omit to send now. */
  scheduledAt?: string;
}

/**
 * Send or schedule a templated outreach email to one or more recipients.
 * Sends are only ever triggered by an explicit user action in the composer.
 * After a successful send, the prospect's Outreach Status is advanced to
 * "Emailed" (or "Queued" when scheduled) so the pipeline stays in sync.
 */
export async function POST(request: Request) {
  if (!brevoConfigured()) {
    return NextResponse.json(
      { error: "BREVO_API_KEY is not configured on the server." },
      { status: 503 }
    );
  }

  let body: SendBody;
  try {
    body = (await request.json()) as SendBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { templateId, recipients, scheduledAt } = body;
  if (!templateId || !Array.isArray(recipients) || recipients.length === 0) {
    return NextResponse.json({ error: "templateId and recipients are required" }, { status: 400 });
  }
  if (recipients.length > 200) {
    return NextResponse.json({ error: "Too many recipients in one request (max 200)" }, { status: 400 });
  }

  const results = [];
  for (const r of recipients) {
    if (!r.email) {
      results.push({ email: "(missing)", ok: false, error: "No email address" });
      continue;
    }
    const result = await sendTemplateEmail({
      templateId,
      email: r.email,
      name: r.name,
      firstName: r.firstName,
      lastName: r.lastName,
      scheduledAt,
    });
    results.push(result);

    // Advance the prospect's outreach status on success.
    if (result.ok && r.recordId) {
      try {
        await updateRecordField(
          BASE_ID,
          TABLES.prospects.id,
          r.recordId,
          TABLES.prospects.fields.outreachStatus.name,
          scheduledAt ? "Queued" : "Emailed"
        );
      } catch {
        // Status update is best-effort; the email already sent.
      }
    }
  }
  invalidate();

  const sent = results.filter((r) => r.ok).length;
  return NextResponse.json({ sent, total: results.length, results });
}
