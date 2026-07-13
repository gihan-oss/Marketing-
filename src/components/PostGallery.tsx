"use client";

import { useState } from "react";
import type { Rec } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { useData } from "./DataProvider";

/** Brand tints per channel, used for the badge and the image-less fallback. */
const CHANNEL_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  LinkedIn: { bg: "#0a66c2", fg: "#ffffff", label: "in" },
  Facebook: { bg: "#1877f2", fg: "#ffffff", label: "f" },
  Instagram: { bg: "#d6249f", fg: "#ffffff", label: "◍" },
};

function str(v: unknown): string {
  return v == null ? "" : String(v);
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Visual card view of published posts: each post as a picture card with its
 * image, channel, date, caption preview, engagement, and a link to the live
 * post. Easier to scan at a glance than the detailed table. Clicking a card
 * opens the same record drill-down drawer the table uses.
 */
export function PostGallery({ posts, title = "Posts" }: { posts: Rec[]; title?: string }) {
  const { setDrawer } = useData();
  if (posts.length === 0) return null;

  return (
    <section aria-label={title}>
      <p className="card-title" style={{ margin: "0 0 10px" }}>
        {title} <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {posts.length}</span>
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))",
          gap: 14,
        }}
      >
        {posts.map((r) => (
          <PostCard key={r.id} rec={r} onOpen={() => setDrawer({ kind: "record", record: r })} />
        ))}
      </div>
    </section>
  );
}

function PostCard({ rec, onOpen }: { rec: Rec; onOpen: () => void }) {
  const [imgOk, setImgOk] = useState(true);
  const channel = str(rec.fields.channel);
  const cs = CHANNEL_STYLE[channel] ?? { bg: "var(--muted)", fg: "#fff", label: "•" };
  const media = str(rec.fields.mediaUrl);
  const caption = str(rec.fields.caption) || "(no caption)";
  const permalink = str(rec.fields.permalink);
  const likes = num(rec.fields.likes);
  const comments = num(rec.fields.comments);
  const showImg = media && imgOk;

  return (
    <div
      className="card"
      style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer" }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
    >
      {/* Image (or channel-tinted fallback when a post has no picture) */}
      <div style={{ position: "relative", height: 150, background: showImg ? "var(--grid)" : cs.bg }}>
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media}
            alt=""
            loading="lazy"
            onError={() => setImgOk(false)}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          // No usable image (e.g. LinkedIn) → a branded tile showing the post
          // text, so the card is still informative rather than an empty logo.
          <div
            style={{
              width: "100%",
              height: "100%",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              color: cs.fg,
              fontSize: 14,
              lineHeight: "20px",
              fontWeight: 600,
              overflow: "hidden",
            }}
          >
            <span
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 5,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {caption}
            </span>
          </div>
        )}
        <span
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            background: cs.bg,
            color: cs.fg,
          }}
        >
          {channel || "—"}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div className="card-note" style={{ margin: 0 }}>
          {rec.fields.published ? fmtDate(str(rec.fields.published)) : "—"}
          {rec.fields.postType ? ` · ${str(rec.fields.postType)}` : ""}
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: "18px",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {caption}
        </p>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
          {(likes != null || comments != null) && (
            <span style={{ color: "var(--muted)" }}>
              {likes != null ? `♥ ${likes}` : ""} {comments != null ? `💬 ${comments}` : ""}
            </span>
          )}
          {permalink && (
            <a
              href={permalink}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ marginLeft: "auto", color: "var(--accent, #2563eb)", fontWeight: 600 }}
            >
              View →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
