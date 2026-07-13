import { NextResponse } from "next/server";
import { supabaseConfigured, listDesigns, saveDesign } from "@/lib/supabase";
import type { EmailDesign } from "@/lib/emailTemplate";

export const dynamic = "force-dynamic";

/** List saved email designs (the reusable library). */
export async function GET() {
  if (!supabaseConfigured()) {
    return NextResponse.json({ configured: false, designs: [] });
  }
  try {
    return NextResponse.json({ configured: true, designs: await listDesigns() });
  } catch (err) {
    return NextResponse.json(
      { configured: true, designs: [], error: err instanceof Error ? err.message : "Failed" },
      { status: 502 }
    );
  }
}

/** Create or update an email design. */
export async function POST(request: Request) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 503 });
  }
  let body: EmailDesign;
  try {
    body = (await request.json()) as EmailDesign;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    return NextResponse.json({ design: await saveDesign(body) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 502 }
    );
  }
}
