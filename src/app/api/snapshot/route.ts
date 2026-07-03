import { NextResponse } from "next/server";
import { fetchSnapshot } from "@/lib/airtable";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("refresh") === "1";
  const snapshot = await fetchSnapshot(force);
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "private, max-age=30" },
  });
}
