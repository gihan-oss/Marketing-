import "server-only";
import {
  CHANNELS,
  log,
  recordRun,
  lastRun,
  type Channel,
  type ChannelResult,
  type PlatformPost,
  type RunReport,
} from "./core";
import { allProviders, configuredProviders, getProvider } from "./providers";
import {
  upsertSocialPosts,
  listDueScheduledContent,
  markContentPublished,
} from "./airtable";

export type { RunReport, ChannelResult, Channel } from "./core";

/**
 * Social automation engine.
 *
 * syncSocialMetrics()      — Phase 1: pull posts + engagement from every
 *                            configured channel and upsert into Social Posts.
 * publishScheduledContent() — Phase 2: publish due, approved Content rows to a
 *                            channel and write the result back into Social Posts.
 *
 * Both are safe to call repeatedly (idempotent) and isolate failures per
 * channel/item so one bad response never aborts the whole run.
 */

function isChannel(v: string | undefined): v is Channel {
  return !!v && (CHANNELS as readonly string[]).includes(v);
}

/** Phase 2 is opt-in and off by default to prevent accidental live posts. */
export function publishEnabled(): boolean {
  return process.env.SOCIAL_PUBLISH_ENABLED === "true";
}

/** The channel scheduled Content is published to (Content has no per-row channel). */
export function defaultPublishChannel(): Channel | null {
  const raw = process.env.SOCIAL_DEFAULT_PUBLISH_CHANNEL;
  return isChannel(raw) ? raw : null;
}

// ---------------------------------------------------------------------------
// Phase 1 — metrics sync
// ---------------------------------------------------------------------------

export async function syncSocialMetrics(): Promise<RunReport> {
  const startedAt = new Date().toISOString();
  const providers = configuredProviders();
  const channels: ChannelResult[] = [];
  const errors: string[] = [];

  if (providers.length === 0) {
    const report: RunReport = {
      kind: "sync",
      startedAt,
      finishedAt: new Date().toISOString(),
      ok: true,
      summary: "No channels configured — nothing to sync.",
      channels: allProviders().map((p) => ({ channel: p.channel, configured: false })),
      errors: [],
    };
    recordRun(report);
    return report;
  }

  for (const provider of providers) {
    const result: ChannelResult = { channel: provider.channel, configured: true };
    try {
      const posts = await provider.fetchPosts();
      result.fetched = posts.length;
      const { created, updated } = await upsertSocialPosts(posts);
      result.created = created;
      result.updated = updated;
      log.info(`${provider.channel}: fetched ${posts.length}, +${created} new, ~${updated} updated`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sync failed";
      result.error = message;
      errors.push(`${provider.channel}: ${message}`);
      log.error(`${provider.channel} sync failed`, err);
    }
    channels.push(result);
  }

  // Include unconfigured channels so the status view is complete.
  for (const p of allProviders()) {
    if (!channels.some((c) => c.channel === p.channel)) {
      channels.push({ channel: p.channel, configured: false });
    }
  }

  const totalPosts = channels.reduce((a, c) => a + (c.created ?? 0) + (c.updated ?? 0), 0);
  const report: RunReport = {
    kind: "sync",
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: errors.length === 0,
    summary: `Synced ${totalPosts} post${totalPosts === 1 ? "" : "s"} across ${providers.length} channel${providers.length === 1 ? "" : "s"}${errors.length ? ` (${errors.length} error${errors.length === 1 ? "" : "s"})` : ""}.`,
    channels,
    errors,
  };
  recordRun(report);
  return report;
}

// ---------------------------------------------------------------------------
// Phase 2 — publish scheduled content
// ---------------------------------------------------------------------------

export async function publishScheduledContent(): Promise<RunReport> {
  const startedAt = new Date().toISOString();
  const base = (summary: string, extra: Partial<RunReport> = {}): RunReport => ({
    kind: "publish",
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: true,
    summary,
    channels: [],
    errors: [],
    ...extra,
  });

  if (!publishEnabled()) {
    const report = base("Publishing is disabled (set SOCIAL_PUBLISH_ENABLED=true to enable).");
    recordRun(report);
    return report;
  }

  const channel = defaultPublishChannel();
  if (!channel) {
    const report = base("No default publish channel set (SOCIAL_DEFAULT_PUBLISH_CHANNEL).", {
      ok: false,
      errors: ["SOCIAL_DEFAULT_PUBLISH_CHANNEL is not set to a valid channel."],
    });
    recordRun(report);
    return report;
  }

  const provider = getProvider(channel);
  if (!provider.configured()) {
    const report = base(`${channel} is not connected — cannot publish.`, {
      ok: false,
      errors: [`${channel} provider is missing credentials.`],
    });
    recordRun(report);
    return report;
  }

  const due = await listDueScheduledContent();
  const errors: string[] = [];
  let published = 0;

  for (const item of due) {
    try {
      const out = await provider.publish({ caption: item.caption, channel, postType: item.postType });
      // Close the loop: write the freshly published post into Social Posts…
      const post: PlatformPost = {
        externalId: out.externalId,
        channel,
        caption: item.caption,
        postType: item.postType,
        published: out.published,
        permalink: out.permalink,
      };
      await upsertSocialPosts([post]);
      // …and only then mark it Published so a failure safely retries next run.
      await markContentPublished(item.id);
      published += 1;
      log.info(`Published Content ${item.id} to ${channel} as ${out.externalId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish failed";
      errors.push(`Content ${item.id}: ${message}`);
      log.error(`Publish failed for Content ${item.id}`, err);
    }
  }

  const report = base(
    `Published ${published} of ${due.length} due item${due.length === 1 ? "" : "s"} to ${channel}${errors.length ? ` (${errors.length} failed)` : ""}.`,
    {
      ok: errors.length === 0,
      channels: [{ channel, configured: true, published }],
      errors,
    }
  );
  recordRun(report);
  return report;
}

// ---------------------------------------------------------------------------
// Status (for the dashboard notice)
// ---------------------------------------------------------------------------

export interface AutomationStatus {
  channels: { channel: Channel; configured: boolean }[];
  anyConfigured: boolean;
  publishEnabled: boolean;
  defaultPublishChannel: Channel | null;
  cronSecretSet: boolean;
  lastSync: RunReport | null;
  lastPublish: RunReport | null;
}

export function automationStatus(): AutomationStatus {
  const channels = allProviders().map((p) => ({ channel: p.channel, configured: p.configured() }));
  return {
    channels,
    anyConfigured: channels.some((c) => c.configured),
    publishEnabled: publishEnabled(),
    defaultPublishChannel: defaultPublishChannel(),
    cronSecretSet: Boolean(process.env.CRON_SECRET),
    lastSync: lastRun("sync"),
    lastPublish: lastRun("publish"),
  };
}

// ---------------------------------------------------------------------------
// Authorization for the trigger endpoints
// ---------------------------------------------------------------------------

/**
 * Authorize a call to the sync/publish endpoints. Accepts:
 *   1. a `Bearer <CRON_SECRET>` header (Vercel Cron / external schedulers), or
 *   2. a same-origin request from the app itself (the in-app "Run now" button).
 * When CRON_SECRET is unset the endpoints are open — intended for local dev
 * only; production should always set CRON_SECRET.
 */
export function authorizeAutomation(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    log.warn("CRON_SECRET is not set — social automation endpoints are unauthenticated.");
    return true;
  }
  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  // Same-origin fallback for the dashboard's manual trigger.
  const host = request.headers.get("host");
  const originHeader = request.headers.get("origin") || request.headers.get("referer");
  if (host && originHeader) {
    try {
      return new URL(originHeader).host === host;
    } catch {
      return false;
    }
  }
  return false;
}
