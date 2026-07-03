import { NextResponse } from "next/server";
import { brevoConfigured, listTemplates } from "@/lib/brevo";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!brevoConfigured()) {
    return NextResponse.json({ configured: false, templates: [] });
  }
  try {
    const templates = await listTemplates();
    return NextResponse.json({ configured: true, templates });
  } catch (err) {
    return NextResponse.json(
      { configured: true, templates: [], error: err instanceof Error ? err.message : "Failed" },
      { status: 502 }
    );
  }
}
