import { NextResponse } from "next/server";
import { brevoConfigured, sendHtmlEmail } from "@/lib/brevo";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface ScriptBody {
  to: string;
  idea: string;
  script?: string;
  presenter?: string;
  channel?: string;
  postType?: string;
  postDate?: string;
  note?: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Email a content script to a reviewer (e.g. the CEO) for approval — a clean
 * internal email with the idea, logistics, and the full script. Explicit
 * user action only; never triggered automatically.
 */
export async function POST(request: Request) {
  if (!brevoConfigured()) {
    return NextResponse.json({ error: "BREVO_API_KEY is not configured on the server." }, { status: 503 });
  }
  let body: ScriptBody;
  try {
    body = (await request.json()) as ScriptBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { to, idea, script, presenter, channel, postType, postDate, note } = body;
  if (!to || !to.includes("@") || !idea) {
    return NextResponse.json({ error: "A valid recipient and the content idea are required." }, { status: 400 });
  }

  const metaRows = [
    presenter && `<tr><td style="padding:4px 12px 4px 0;color:#5b6b76;">Presenter</td><td style="padding:4px 0;"><strong>${esc(presenter)}</strong></td></tr>`,
    channel && `<tr><td style="padding:4px 12px 4px 0;color:#5b6b76;">Channel</td><td style="padding:4px 0;"><strong>${esc(channel)}</strong></td></tr>`,
    postType && `<tr><td style="padding:4px 12px 4px 0;color:#5b6b76;">Format</td><td style="padding:4px 0;"><strong>${esc(postType)}</strong></td></tr>`,
    postDate && `<tr><td style="padding:4px 12px 4px 0;color:#5b6b76;">Planned date</td><td style="padding:4px 0;"><strong>${esc(postDate.slice(0, 10))}</strong></td></tr>`,
  ]
    .filter(Boolean)
    .join("");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#eef2f6;font-family:'Segoe UI',Arial,sans-serif;color:#1f2a33;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dbe4ec;">
    <div style="background:#14344a;color:#ffffff;padding:18px 24px;">
      <div style="font-size:15px;font-weight:800;letter-spacing:1px;">AMAL &amp; COMPANY</div>
      <div style="font-size:12px;color:#8fbfe6;margin-top:2px;">Content script for review</div>
    </div>
    <div style="padding:24px;">
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.35;color:#14344a;">${esc(idea)}</h1>
      ${metaRows ? `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin:0 0 16px;">${metaRows}</table>` : ""}
      ${note ? `<p style="font-size:14px;line-height:1.6;background:#eaf3fb;border-radius:8px;padding:12px 14px;margin:0 0 16px;">${esc(note)}</p>` : ""}
      ${
        script
          ? `<div style="font-size:12px;letter-spacing:1.5px;color:#5b6b76;text-transform:uppercase;font-weight:700;margin:0 0 8px;">Script</div>
             <div style="font-size:15px;line-height:1.7;white-space:pre-wrap;border-left:3px solid #2f7ec4;padding:2px 0 2px 14px;">${esc(script)}</div>`
          : `<p style="font-size:14px;color:#5b6b76;">(No script attached yet.)</p>`
      }
      <p style="font-size:13px;color:#5b6b76;margin:22px 0 0;">Reply to this email with approval or edits.</p>
    </div>
  </div>
</body></html>`;

  const result = await sendHtmlEmail({
    email: to,
    subject: `Script for review: ${idea.slice(0, 80)}`,
    html,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Send failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, to });
}
