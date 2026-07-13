import "server-only";

/**
 * Social automation — shared primitives.
 *
 * The automation engine syncs published-post engagement from LinkedIn /
 * Instagram / Facebook into the Airtable "Social Posts" table (Phase 1) and,
 * when explicitly enabled, publishes scheduled Content rows to a channel
 * (Phase 2). Everything here is server-only and gated on environment
 * credentials: a channel is simply skipped when its token is not configured,
 * mirroring how the rest of the platform degrades gracefully without keys.
 */

export type Channel = "LinkedIn" | "Instagram" | "Facebook";

/** Channels in the same order as the Social Posts "Channel" select options. */
export const CHANNELS: readonly Channel[] = ["LinkedIn", "Instagram", "Facebook"] as const;

/** A post + its engagement, normalized from a platform API into schema shape. */
export interface PlatformPost {
  /** Stable per-platform identity — the upsert key into Social Posts. */
  externalId: string;
  channel: Channel;
  caption?: string;
  /** One of the Social Posts "Post Type" options. */
  postType?: string;
  /** ISO-8601 publish timestamp. */
  published?: string;
  permalink?: string;
  mediaUrl?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  reach?: number;
  impressions?: number;
}

/** A request to publish one piece of content to a channel. */
export interface PublishInput {
  channel: Channel;
  caption: string;
  mediaUrl?: string;
  postType?: string;
}

/** The result of a successful publish — feeds straight back into Social Posts. */
export interface PublishOutput {
  externalId: string;
  permalink?: string;
  published?: string;
}

/** A single channel integration. Implementations live in ./providers. */
export interface SocialProvider {
  channel: Channel;
  /** True only when every credential this channel needs is present. */
  configured(): boolean;
  /** Pull recent posts + engagement (most-recent first). */
  fetchPosts(limit?: number): Promise<PlatformPost[]>;
  /** Publish a post and return its identity. Throws on failure. */
  publish(input: PublishInput): Promise<PublishOutput>;
}

// ---------------------------------------------------------------------------
// Retry with exponential backoff — used around every outbound platform call so
// a transient 5xx / rate-limit blip doesn't fail a whole channel's sync.
// ---------------------------------------------------------------------------

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  /** Label for log lines. */
  label?: string;
  /** Decide whether an error is worth retrying (default: everything). */
  retryable?: (err: unknown) => boolean;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { retries = 3, baseDelayMs = 500, label = "op", retryable = () => true } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !retryable(err)) break;
      // 0.5s, 1s, 2s … with a little jitter to avoid thundering herds.
      const delay = baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 100);
      log.warn(`${label}: attempt ${attempt + 1}/${retries + 1} failed, retrying in ${delay}ms`, err);
      await sleep(delay);
    }
  }
  throw lastErr;
}

/** HTTP status codes that are safe to retry (transient / rate-limited). */
export function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

// ---------------------------------------------------------------------------
// Structured logging + a small in-memory ring buffer of recent run reports.
// Console lines are captured by the host's log drain (e.g. Vercel logs); the
// ring buffer powers the /api/social/status view within a single instance.
// ---------------------------------------------------------------------------

type LogLevel = "info" | "warn" | "error";

function emit(level: LogLevel, msg: string, extra?: unknown) {
  const line = `[social] ${msg}`;
  if (level === "error") console.error(line, extra ?? "");
  else if (level === "warn") console.warn(line, extra ?? "");
  else console.info(line, extra ?? "");
}

export const log = {
  info: (msg: string, extra?: unknown) => emit("info", msg, extra),
  warn: (msg: string, extra?: unknown) => emit("warn", msg, extra),
  error: (msg: string, extra?: unknown) => emit("error", msg, extra),
};

export interface RunReport {
  kind: "sync" | "publish";
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  /** Human summary, e.g. "Synced 12 posts across 2 channels". */
  summary: string;
  /** Per-channel detail. */
  channels: ChannelResult[];
  errors: string[];
}

export interface ChannelResult {
  channel: Channel;
  configured: boolean;
  fetched?: number;
  created?: number;
  updated?: number;
  published?: number;
  error?: string;
}

const RECENT_RUNS_MAX = 10;
const recentRuns: RunReport[] = [];

export function recordRun(report: RunReport) {
  recentRuns.unshift(report);
  if (recentRuns.length > RECENT_RUNS_MAX) recentRuns.length = RECENT_RUNS_MAX;
}

export function lastRun(kind?: RunReport["kind"]): RunReport | null {
  return recentRuns.find((r) => !kind || r.kind === kind) ?? null;
}
