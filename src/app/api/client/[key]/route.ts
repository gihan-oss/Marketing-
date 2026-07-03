import { NextResponse } from "next/server";
import { fetchClientSnapshot } from "@/lib/airtable";
import { CLIENTS, type ClientKey } from "@/lib/clients";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  if (!(key in CLIENTS)) {
    return NextResponse.json({ error: "Unknown client" }, { status: 404 });
  }
  const force = new URL(request.url).searchParams.get("refresh") === "1";
  const snapshot = await fetchClientSnapshot(key as ClientKey, force);
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "private, max-age=30" } });
}
