import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { supabaseConfigured, uploadEmailImage } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/**
 * Upload a hero image for the Email Studio to Supabase Storage and return its
 * permanent public URL — the URL that email clients can actually load.
 */
export async function POST(request: Request) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 503 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG, GIF, or WEBP image." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is larger than 8 MB." }, { status: 400 });
  }
  try {
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const filename = `${randomUUID()}.${ext}`;
    const url = await uploadEmailImage(await file.arrayBuffer(), file.type, filename);
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 502 }
    );
  }
}
