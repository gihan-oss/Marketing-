#!/usr/bin/env node
/**
 * Retarget the image URLs in the outreach email template to a public asset
 * host. Email clients cannot load images from a Vercel *preview* deployment
 * (those sit behind Deployment Protection / SSO and return an auth page instead
 * of the image), so the template must point at a public production URL.
 *
 * Usage:
 *   EMAIL_ASSET_BASE_URL=https://your-domain.com node scripts/build-email-template.mjs
 *
 * It rewrites every `src=".../email/<file>"` in the template to
 * `${EMAIL_ASSET_BASE_URL}/email/<file>`, in place and idempotently, so the
 * host lives in exactly one place (the env var) rather than being hand-edited.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(__dirname, "..", "emails", "amal-bold-outreach.html");

const base = (process.env.EMAIL_ASSET_BASE_URL || "https://marketing-gigi12313-s-projects13.vercel.app").replace(
  /\/+$/,
  ""
);

const html = await readFile(TEMPLATE, "utf8");
let count = 0;
const next = html.replace(/src="[^"]*\/email\/([^"]+)"/g, (_m, file) => {
  count += 1;
  return `src="${base}/email/${file}"`;
});

if (next !== html) {
  await writeFile(TEMPLATE, next, "utf8");
}
console.log(`Retargeted ${count} email image URL(s) to ${base}/email/ in ${TEMPLATE}`);
