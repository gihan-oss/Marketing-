import { NextResponse } from "next/server";
import { brevoConfigured, getTemplate } from "@/lib/brevo";

export const dynamic = "force-dynamic";

/**
 * Return one template's subject + HTML body so the composer can render an
 * in-app preview. Read-only; sends nothing.
 */
export async function GET(request: Request) {
  if (!brevoConfigured()) {
    return NextResponse.json({ configured: false }, { status: 503 });
  }
  const id = Number(new URL(request.url).searchParams.get("templateId"));
  if (!id) {
    return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  }
  try {
    const t = await getTemplate(id);
    return NextResponse.json({ configured: true, subject: t.subject, html: t.htmlContent });
  } catch (err) {
    return NextResponse.json(
      { configured: true, error: err instanceof Error ? err.message : "Failed" },
      { status: 502 }
    );
  }
}
