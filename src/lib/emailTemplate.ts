/**
 * The fixed, on-brand outreach email. Branding (logo, nav, footer, colors,
 * layout) is locked; only the fields in `EmailDesign` are editable per email.
 * `renderOutreachEmail` fills those fields into the template and returns the
 * complete HTML used for both the in-app preview and the Brevo send.
 */

export interface EmailDesign {
  id?: string;
  /** Internal name for the saved design (not shown in the email). */
  name?: string;
  /** Small uppercase kicker above the headline. */
  eyebrow?: string;
  /** Big headline. Use " / " to force line breaks; the last word is accented. */
  headline?: string;
  /** One-line sub-headline under the big title. */
  subhead?: string;
  /** Public URL of the hero image (from Supabase Storage). */
  imageUrl?: string;
  /** Main body message. Blank lines become separate paragraphs. */
  body?: string;
  /** The bold question / key line. */
  question?: string;
  ctaText?: string;
  ctaUrl?: string;
  createdAt?: string;
}

/** The Amal logo, hosted on the public marketing domain used elsewhere. */
const LOGO_URL = "https://toc.amalandco.com/logo-white.png";

const DEFAULTS: Required<Omit<EmailDesign, "id" | "name" | "createdAt">> = {
  eyebrow: "Operational Transformation",
  headline: "MAKE THE / PLAN / HAPPEN.",
  subhead:
    "Most teams don’t have a strategy problem. They have an execution problem — the plan never becomes how the work actually runs.",
  imageUrl: "",
  body: "Hi {{ contact.FIRSTNAME | default : \"there\" }},\n\nI’ll keep this short. At Amal & Company we help mission-driven organizations and growing practices turn strategy into systems that actually run — less friction, clearer roles, change that sticks after the room clears.",
  question:
    "One question: where does execution break down most in your organization right now — alignment, follow-through, or day-to-day operations?",
  ctaText: "Book a 20-min discovery call →",
  ctaUrl: "https://calendar.app.google/obSbvAsJXZ3XK4rs8",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escapes text but preserves Brevo merge tags like {{ contact.FIRSTNAME }}. */
function escKeepMergeTags(s: string): string {
  return s
    .split(/(\{\{[^}]*\}\})/g)
    .map((part) => (part.startsWith("{{") ? part : esc(part)))
    .join("");
}

/** Split on blank lines into <p> blocks; single newlines become <br>. */
function paragraphs(text: string, style: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="${style}">${escKeepMergeTags(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function headlineHtml(headline: string): string {
  const lines = headline.split("/").map((l) => l.trim()).filter(Boolean);
  return lines
    .map((line, i) =>
      i === lines.length - 1 ? `<span style="color:#5fa3da;">${esc(line)}</span>` : esc(line)
    )
    .join("<br>");
}

export function renderOutreachEmail(input: EmailDesign): string {
  const d = { ...DEFAULTS, ...clean(input) };
  const hero = d.imageUrl
    ? `<tr><td style="padding:26px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:0;font-size:0;line-height:0;"><img src="${esc(d.imageUrl)}" width="600" alt="Amal &amp; Company" style="width:100%;max-width:600px;height:auto;display:block;"></td></tr></table></td></tr>`
    : "";

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Amal &amp; Company</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&display=swap" rel="stylesheet">
<!--[if mso]><style>*{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
<style>
  body{margin:0;padding:0;background:#c9d3db;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table{border-collapse:collapse;}
  img{border:0;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;display:block;}
  a{text-decoration:none;}
  .mont{font-family:'Montserrat','Segoe UI',Arial,Helvetica,sans-serif;}
  .btn:hover{background:#ffffff !important;color:#14344a !important;}
  @media only screen and (max-width:620px){
    .container{width:100% !important;}
    .px{padding-left:24px !important;padding-right:24px !important;}
    .giant{font-size:64px !important;line-height:60px !important;}
    .nav a{font-size:11px !important;padding:0 8px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#c9d3db;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#c9d3db;">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#14344a;">
        <tr><td align="center" class="mont" style="padding:30px 30px 6px;font-family:'Montserrat',Arial,sans-serif;">
          <img src="${LOGO_URL}" width="236" alt="Amal &amp; Company" style="display:inline-block;width:236px;max-width:72%;height:auto;">
        </td></tr>
        <tr><td align="center" class="nav mont" style="padding:8px 20px 20px;font-family:'Montserrat',Arial,sans-serif;border-bottom:1px solid #2a4a5e;">
          <a href="https://www.amalandcompany.com" style="color:#cdddea;font-size:13px;font-weight:600;letter-spacing:.5px;padding:0 14px;">Approach</a>
          <a href="https://www.amalandcompany.com" style="color:#cdddea;font-size:13px;font-weight:600;letter-spacing:.5px;padding:0 14px;">Retreats</a>
          <a href="https://www.amalandcompany.com" style="color:#cdddea;font-size:13px;font-weight:600;letter-spacing:.5px;padding:0 14px;">Insights</a>
          <a href="https://www.amalandcompany.com" style="color:#cdddea;font-size:13px;font-weight:600;letter-spacing:.5px;padding:0 14px;">About</a>
        </td></tr>
        <tr><td class="px" style="padding:44px 44px 8px;font-family:'Montserrat',Arial,sans-serif;">
          <div style="font-size:13px;font-weight:700;letter-spacing:3px;color:#5fa3da;text-transform:uppercase;">${esc(d.eyebrow)}</div>
        </td></tr>
        <tr><td class="px giant mont" style="padding:6px 44px 6px;font-family:'Montserrat',Arial,sans-serif;font-size:78px;line-height:72px;font-weight:900;color:#ffffff;letter-spacing:-1px;">${headlineHtml(d.headline)}</td></tr>
        <tr><td class="px" style="padding:18px 44px 4px;font-family:'Montserrat',Arial,sans-serif;font-size:16px;line-height:25px;font-weight:400;color:#c6d6e2;">${escKeepMergeTags(d.subhead)}</td></tr>
        ${hero}
        <tr><td class="px" style="padding:34px 44px 6px;font-family:'Montserrat',Arial,sans-serif;font-size:16px;line-height:26px;color:#c6d6e2;">
          ${paragraphs(d.body, "margin:0 0 16px;")}
          <p style="margin:0 0 4px;color:#ffffff;font-weight:600;">${escKeepMergeTags(d.question)}</p>
        </td></tr>
        <tr><td class="px" style="padding:26px 44px 10px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td bgcolor="#5fa3da" class="btn" style="background:#5fa3da;border-radius:2px;"><a class="btn mont" href="${esc(d.ctaUrl)}" target="_blank" style="display:inline-block;padding:17px 40px;font-family:'Montserrat',Arial,sans-serif;font-size:15px;font-weight:800;letter-spacing:1px;color:#0e2636;background:#5fa3da;border-radius:2px;text-transform:uppercase;">${esc(d.ctaText)}</a></td>
        </tr></table></td></tr>
        <tr><td class="px" style="padding:2px 44px 40px;font-family:'Montserrat',Arial,sans-serif;font-size:13px;line-height:20px;color:#7f97a8;">No pitch — 20 minutes to map where work breaks down. You keep the map either way.</td></tr>
        <tr><td style="background:#0e2636;padding:28px 44px;font-family:'Montserrat',Arial,sans-serif;border-top:1px solid #2a4a5e;">
          <div style="font-size:16px;font-weight:800;letter-spacing:1px;color:#ffffff;">AMAL &amp; COMPANY</div>
          <div style="font-size:11px;letter-spacing:2px;color:#5fa3da;margin-top:3px;font-weight:600;">SCALING SOCIAL IMPACT</div>
          <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
          <div style="font-size:12px;line-height:19px;color:#8ba4b5;"><a href="https://www.amalandcompany.com" style="color:#5fa3da;">www.amalandcompany.com</a><br>Organizational transformation &middot; Operational execution &middot; Human-centered systems</div>
          <div style="font-size:11px;line-height:18px;color:#5a7285;border-top:1px solid #234156;padding-top:14px;margin-top:16px;">You&rsquo;re receiving this because your organization may benefit from clearer operating systems. &nbsp;<a href="{{ unsubscribe }}" style="color:#5fa3da;text-decoration:underline;">Unsubscribe</a></div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Drop undefined/empty fields so DEFAULTS win for anything not provided. */
function clean(input: EmailDesign): Partial<EmailDesign> {
  const out: Partial<EmailDesign> = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === "string" && v.trim() !== "") (out as Record<string, string>)[k] = v;
  }
  return out;
}
