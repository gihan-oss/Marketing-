import "server-only";
import {
  withRetry,
  isTransientStatus,
  type Channel,
  type PlatformPost,
  type PublishInput,
  type PublishOutput,
  type SocialProvider,
  log,
} from "./core";

/**
 * Channel providers. Each talks to its platform's official Graph/REST API using
 * server-side tokens supplied via environment variables, and is considered
 * "configured" only when every credential it needs is present. Reads (Phase 1)
 * are always safe; publishing (Phase 2) is additionally gated by the engine.
 *
 * Credentials (all optional — a missing channel is simply skipped):
 *   LinkedIn   LINKEDIN_ACCESS_TOKEN, LINKEDIN_AUTHOR_URN, [LINKEDIN_API_VERSION]
 *   Instagram  INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_BUSINESS_ACCOUNT_ID, [FB_GRAPH_VERSION]
 *   Facebook   FACEBOOK_PAGE_ACCESS_TOKEN, FACEBOOK_PAGE_ID, [FB_GRAPH_VERSION]
 */

const GRAPH_VERSION = process.env.FB_GRAPH_VERSION || "v21.0";
const GRAPH_ROOT = `https://graph.facebook.com/${GRAPH_VERSION}`;
const LINKEDIN_ROOT = "https://api.linkedin.com/rest";
const LINKEDIN_VERSION = process.env.LINKEDIN_API_VERSION || "202401";

/** Fetch JSON with retry on transient/rate-limit responses. */
async function httpJson<T>(url: string, init: RequestInit, label: string): Promise<T> {
  return withRetry(
    async () => {
      const res = await fetch(url, { ...init, cache: "no-store" });
      if (!res.ok) {
        const body = await res.text();
        const err = new Error(`${label} ${res.status}: ${body}`) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      return (await res.json()) as T;
    },
    {
      label,
      retryable: (e) => {
        const s = (e as { status?: number }).status;
        return s === undefined || isTransientStatus(s);
      },
    }
  );
}

const toInt = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

// ---------------------------------------------------------------------------
// Facebook Page
// ---------------------------------------------------------------------------

interface FbPost {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
  status_type?: string;
  shares?: { count?: number };
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
}

function fbPostType(statusType?: string): string {
  switch (statusType) {
    case "added_photos":
      return "Image";
    case "added_video":
    case "shared_video":
      return "Video";
    case "shared_story":
      return "Link";
    default:
      return "Text";
  }
}

const facebook: SocialProvider = {
  channel: "Facebook",
  configured: () =>
    Boolean(process.env.FACEBOOK_PAGE_ACCESS_TOKEN && process.env.FACEBOOK_PAGE_ID),
  async fetchPosts(limit = 50) {
    const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN!;
    const pageId = process.env.FACEBOOK_PAGE_ID!;
    const fields =
      "id,message,created_time,permalink_url,full_picture,status_type," +
      "shares,reactions.summary(total_count),comments.summary(total_count)";
    const url = `${GRAPH_ROOT}/${pageId}/posts?fields=${encodeURIComponent(fields)}&limit=${limit}&access_token=${token}`;
    const body = await httpJson<{ data: FbPost[] }>(url, {}, "facebook.posts");

    return Promise.all(
      (body.data ?? []).map(async (p): Promise<PlatformPost> => {
        const insights = await fbInsights(p.id, token);
        return {
          externalId: p.id,
          channel: "Facebook",
          caption: p.message,
          postType: fbPostType(p.status_type),
          published: p.created_time,
          permalink: p.permalink_url,
          mediaUrl: p.full_picture,
          likes: p.reactions?.summary?.total_count,
          comments: p.comments?.summary?.total_count,
          shares: p.shares?.count,
          reach: insights.reach,
          impressions: insights.impressions,
        };
      })
    );
  },
  async publish(input) {
    const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN!;
    const pageId = process.env.FACEBOOK_PAGE_ID!;
    // Photo posts go to /photos with the image URL; text posts to /feed.
    const endpoint = input.mediaUrl ? "photos" : "feed";
    const params = new URLSearchParams({ access_token: token });
    if (input.mediaUrl) {
      params.set("url", input.mediaUrl);
      params.set("caption", input.caption);
    } else {
      params.set("message", input.caption);
    }
    const res = await httpJson<{ id?: string; post_id?: string }>(
      `${GRAPH_ROOT}/${pageId}/${endpoint}`,
      { method: "POST", body: params },
      "facebook.publish"
    );
    const externalId = res.post_id || res.id!;
    return {
      externalId,
      permalink: `https://www.facebook.com/${externalId}`,
      published: new Date().toISOString(),
    };
  },
};

async function fbInsights(
  postId: string,
  token: string
): Promise<{ reach?: number; impressions?: number }> {
  try {
    const url = `${GRAPH_ROOT}/${postId}/insights?metric=post_impressions,post_impressions_unique&access_token=${token}`;
    const body = await httpJson<{ data: { name: string; values: { value: number }[] }[] }>(
      url,
      {},
      "facebook.insights"
    );
    let reach: number | undefined;
    let impressions: number | undefined;
    for (const m of body.data ?? []) {
      const v = m.values?.[0]?.value;
      if (m.name === "post_impressions_unique") reach = toInt(v);
      if (m.name === "post_impressions") impressions = toInt(v);
    }
    return { reach, impressions };
  } catch (err) {
    // Insights require extra permissions and aren't available for every post —
    // never let a missing metric fail the whole sync.
    log.warn(`facebook.insights unavailable for ${postId}`, err);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Instagram (Business account via the Graph API)
// ---------------------------------------------------------------------------

interface IgMedia {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  timestamp?: string;
  permalink?: string;
  media_url?: string;
  thumbnail_url?: string;
  like_count?: number;
  comments_count?: number;
}

function igPostType(m: IgMedia): string {
  if (m.media_product_type === "REELS") return "Reel";
  if (m.media_product_type === "STORY") return "Story";
  if (m.media_type === "CAROUSEL_ALBUM") return "Carousel";
  if (m.media_type === "VIDEO") return "Video";
  return "Image";
}

const instagram: SocialProvider = {
  channel: "Instagram",
  configured: () =>
    Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID),
  async fetchPosts(limit = 50) {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN!;
    const igUser = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID!;
    const fields =
      "id,caption,media_type,media_product_type,timestamp,permalink,media_url,thumbnail_url,like_count,comments_count";
    const url = `${GRAPH_ROOT}/${igUser}/media?fields=${encodeURIComponent(fields)}&limit=${limit}&access_token=${token}`;
    const body = await httpJson<{ data: IgMedia[] }>(url, {}, "instagram.media");

    return Promise.all(
      (body.data ?? []).map(async (m): Promise<PlatformPost> => {
        const insights = await igInsights(m.id, token);
        return {
          externalId: m.id,
          channel: "Instagram",
          caption: m.caption,
          postType: igPostType(m),
          published: m.timestamp,
          permalink: m.permalink,
          mediaUrl: m.media_url || m.thumbnail_url,
          likes: m.like_count,
          comments: m.comments_count,
          reach: insights.reach,
          impressions: insights.impressions,
        };
      })
    );
  },
  async publish(input) {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN!;
    const igUser = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID!;
    if (!input.mediaUrl) {
      throw new Error("Instagram requires an image or video URL to publish.");
    }
    // Two-step: create a media container, then publish it.
    const createParams = new URLSearchParams({
      image_url: input.mediaUrl,
      caption: input.caption,
      access_token: token,
    });
    const container = await httpJson<{ id: string }>(
      `${GRAPH_ROOT}/${igUser}/media`,
      { method: "POST", body: createParams },
      "instagram.container"
    );
    const publishParams = new URLSearchParams({ creation_id: container.id, access_token: token });
    const published = await httpJson<{ id: string }>(
      `${GRAPH_ROOT}/${igUser}/media_publish`,
      { method: "POST", body: publishParams },
      "instagram.publish"
    );
    return { externalId: published.id, published: new Date().toISOString() };
  },
};

async function igInsights(
  mediaId: string,
  token: string
): Promise<{ reach?: number; impressions?: number }> {
  try {
    const url = `${GRAPH_ROOT}/${mediaId}/insights?metric=reach,impressions&access_token=${token}`;
    const body = await httpJson<{ data: { name: string; values: { value: number }[] }[] }>(
      url,
      {},
      "instagram.insights"
    );
    let reach: number | undefined;
    let impressions: number | undefined;
    for (const m of body.data ?? []) {
      const v = m.values?.[0]?.value;
      if (m.name === "reach") reach = toInt(v);
      if (m.name === "impressions") impressions = toInt(v);
    }
    return { reach, impressions };
  } catch (err) {
    log.warn(`instagram.insights unavailable for ${mediaId}`, err);
    return {};
  }
}

// ---------------------------------------------------------------------------
// LinkedIn (own profile / administered Company Page)
// ---------------------------------------------------------------------------

interface LiPost {
  id: string;
  commentary?: string;
  createdAt?: number;
  content?: { media?: { id?: string } };
}

function linkedinHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": LINKEDIN_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

const linkedin: SocialProvider = {
  channel: "LinkedIn",
  configured: () =>
    Boolean(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_AUTHOR_URN),
  async fetchPosts(limit = 50) {
    const token = process.env.LINKEDIN_ACCESS_TOKEN!;
    const author = process.env.LINKEDIN_AUTHOR_URN!;
    const url =
      `${LINKEDIN_ROOT}/posts?q=author&author=${encodeURIComponent(author)}` +
      `&count=${limit}&sortBy=CREATED`;
    const body = await httpJson<{ elements: LiPost[] }>(
      url,
      { headers: linkedinHeaders(token) },
      "linkedin.posts"
    );

    return Promise.all(
      (body.elements ?? []).map(async (p): Promise<PlatformPost> => {
        const stats = await linkedinStats(p.id, token);
        return {
          externalId: p.id,
          channel: "LinkedIn",
          caption: p.commentary,
          postType: p.content?.media ? "Image" : "Text",
          published: p.createdAt ? new Date(p.createdAt).toISOString() : undefined,
          permalink: `https://www.linkedin.com/feed/update/${p.id}`,
          likes: stats.likes,
          comments: stats.comments,
          impressions: stats.impressions,
          reach: stats.impressions,
        };
      })
    );
  },
  async publish(input) {
    const token = process.env.LINKEDIN_ACCESS_TOKEN!;
    const author = process.env.LINKEDIN_AUTHOR_URN!;
    const res = await withRetry(
      async () => {
        const r = await fetch(`${LINKEDIN_ROOT}/posts`, {
          method: "POST",
          headers: { ...linkedinHeaders(token), "Content-Type": "application/json" },
          body: JSON.stringify({
            author,
            commentary: input.caption,
            visibility: "PUBLIC",
            distribution: { feedDistribution: "MAIN_FEED" },
            lifecycleState: "PUBLISHED",
          }),
          cache: "no-store",
        });
        if (!r.ok) {
          const err = new Error(`linkedin.publish ${r.status}: ${await r.text()}`) as Error & {
            status?: number;
          };
          err.status = r.status;
          throw err;
        }
        // LinkedIn returns the new post URN in the x-restli-id header.
        return r.headers.get("x-restli-id") ?? "";
      },
      { label: "linkedin.publish", retryable: (e) => isTransientStatus((e as { status?: number }).status ?? 0) }
    );
    return {
      externalId: res,
      permalink: res ? `https://www.linkedin.com/feed/update/${res}` : undefined,
      published: new Date().toISOString(),
    };
  },
};

async function linkedinStats(
  urn: string,
  token: string
): Promise<{ likes?: number; comments?: number; impressions?: number }> {
  try {
    const url = `${LINKEDIN_ROOT}/socialActions/${encodeURIComponent(urn)}`;
    const body = await httpJson<{
      likesSummary?: { totalLikes?: number };
      commentsSummary?: { totalComments?: number };
    }>(url, { headers: linkedinHeaders(token) }, "linkedin.socialActions");
    return {
      likes: toInt(body.likesSummary?.totalLikes),
      comments: toInt(body.commentsSummary?.totalComments),
    };
  } catch (err) {
    log.warn(`linkedin stats unavailable for ${urn}`, err);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const PROVIDERS: Record<Channel, SocialProvider> = {
  LinkedIn: linkedin,
  Instagram: instagram,
  Facebook: facebook,
};

export function getProvider(channel: Channel): SocialProvider {
  return PROVIDERS[channel];
}

export function allProviders(): SocialProvider[] {
  return Object.values(PROVIDERS);
}

export function configuredProviders(): SocialProvider[] {
  return allProviders().filter((p) => p.configured());
}
