import { NextResponse } from "next/server";
import { authorizeAutomation, syncSocialMetrics } from "@/lib/social";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Phase 1 sync: pull posts + engagement from every connected channel and
 * upsert them into the Social Posts table. Triggered by Vercel Cron (daily) or
 * manually from the dashboard. Read-only against the social platforms; the only
 * writes are idempotent upserts into Airtable.
 */
async function handle(request: Request) {
  if (!authorizeAutomation(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const report = await syncSocialMetrics();
    return NextResponse.json(report, { status: report.ok ? 200 : 207 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}

// GET so Vercel Cron (which issues GETs) can trigger it; POST for manual runs.
export const GET = handle;
export const POST = handle;
