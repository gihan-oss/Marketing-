import { NextResponse } from "next/server";
import { automationStatus } from "@/lib/social";

export const dynamic = "force-dynamic";

/**
 * Report the automation's configuration + most recent run (per instance) so the
 * Published Posts page can show which channels are connected and when the last
 * sync ran. Read-only; exposes no secrets — only booleans and run summaries.
 */
export async function GET() {
  return NextResponse.json(automationStatus());
}
