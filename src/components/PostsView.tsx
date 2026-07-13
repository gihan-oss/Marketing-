"use client";

import { useState } from "react";
import type { Rec } from "@/lib/types";
import { PostGallery } from "./PostGallery";
import { DataTable } from "./DataTable";

type Mode = "gallery" | "table";

/**
 * Published Posts viewer with a Gallery / Table view-mode switch. Gallery
 * (picture cards) is the default for quick visual scanning; Table gives the
 * full sortable/searchable/exportable detail. Same records feed both.
 */
export function PostsView({ posts }: { posts: Rec[] }) {
  const [mode, setMode] = useState<Mode>("gallery");

  return (
    <section aria-label="Published posts">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <p className="card-title" style={{ margin: 0, flex: 1 }}>
          Posts <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {posts.length}</span>
        </p>
        <div role="tablist" aria-label="View mode" style={{ display: "inline-flex", gap: 4 }}>
          <ModeButton active={mode === "gallery"} onClick={() => setMode("gallery")}>
            ▦ Gallery
          </ModeButton>
          <ModeButton active={mode === "table"} onClick={() => setMode("table")}>
            ☰ Table
          </ModeButton>
        </div>
      </div>

      {mode === "gallery" ? (
        <PostGallery posts={posts} title="" />
      ) : (
        <DataTable
          table="social"
          records={posts}
          columns={[
            "caption",
            "channel",
            "postType",
            "published",
            "likes",
            "comments",
            "shares",
            "reach",
            "impressions",
            "permalink",
          ]}
          title="All published posts"
        />
      )}
    </section>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      className="btn"
      onClick={onClick}
      style={
        active
          ? { background: "var(--accent, #2563eb)", color: "#fff", borderColor: "transparent" }
          : undefined
      }
    >
      {children}
    </button>
  );
}
