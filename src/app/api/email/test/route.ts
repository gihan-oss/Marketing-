import { NextResponse } from "next/server";
import { brevoConfigured, sendTemplateEmail } from "@/lib/brevo";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface TestBody {
  templateId: number;
  email: string;
  firstName?: string;
}

/**
 * Send a single test email of a template to one address (e.g. yourself),
 * to preview it before a real send. Unlike /api/email/send this never
 * touches prospect records, never schedules, and never advances any status.
 */
export async function POST(request: Request) {
  if (!brevoConfigured()) {
    return NextResponse.json(
      { error: "BREVO_API_KEY is not configured on the server." },
      { status: 503 }
    );
  }

  let body: TestBody;
  try {
    body = (await request.json()) as TestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { templateId, email, firstName } = body;
  if (!templateId || !email || !email.includes("@")) {
    return NextResponse.json({ error: "A templateId and a valid email are required." }, { status: 400 });
  }

  const result = await sendTemplateEmail({
    templateId,
    email,
    firstName: firstName || "there",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Send failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, email });
}
