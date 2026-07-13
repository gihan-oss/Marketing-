import { NextResponse } from "next/server";
import { brevoConfigured, createBrevoTemplate, sendHtmlEmail } from "@/lib/brevo";
import { renderOutreachEmail, type EmailDesign } from "@/lib/emailTemplate";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface Body {
  design: EmailDesign;
  /** "test" emails the rendered design to `email`; "publish" creates a Brevo template. */
  action: "test" | "publish";
  email?: string;
}

/**
 * Email Studio actions: send a test of a design to one address, or publish
 * the design as an active Brevo template (so the outreach composer can use
 * it). Both render the same locked brand template with the design's fields.
 */
export async function POST(request: Request) {
  if (!brevoConfigured()) {
    return NextResponse.json({ error: "BREVO_API_KEY is not configured on the server." }, { status: 503 });
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const html = renderOutreachEmail(body.design ?? {});

  try {
    if (body.action === "publish") {
      const name = body.design.name?.trim() || "Studio design";
      const subject = body.design.headline
        ? body.design.headline.replace(/\s*\/\s*/g, " ").trim()
        : "A note from Amal & Company";
      const id = await createBrevoTemplate({ name: `Studio — ${name}`, subject, html });
      return NextResponse.json({ ok: true, templateId: id });
    }
    if (!body.email || !body.email.includes("@")) {
      return NextResponse.json({ error: "A valid test email is required." }, { status: 400 });
    }
    // Test sends replace merge tags so the preview reads naturally.
    const testHtml = html
      .replace(/\{\{\s*contact\.FIRSTNAME[^}]*\}\}/g, "there")
      .replace(/\{\{\s*unsubscribe\s*\}\}/g, "#");
    const result = await sendHtmlEmail({
      email: body.email,
      subject: "[Test] Email Studio design preview",
      html: testHtml,
    });
    if (!result.ok) return NextResponse.json({ error: result.error ?? "Send failed" }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 502 }
    );
  }
}
