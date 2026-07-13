import { NextResponse } from "next/server";
import { authorizeAutomation, publishScheduledContent } from "@/lib/social";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Phase 2 publish: publish due, approved Content rows to the configured default
 * channel and write each result back into Social Posts. Disabled unless
 * SOCIAL_PUBLISH_ENABLED=true. Triggered by Vercel Cron or manually.
 */
async function handle(request: Request) {
  if (!authorizeAutomation(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const report = await publishScheduledContent();
    return NextResponse.json(report, { status: report.ok ? 200 : 207 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Publish failed" },
      { status: 500 }
    );
  }
}

export const GET = handle;
export const POST = handle;
