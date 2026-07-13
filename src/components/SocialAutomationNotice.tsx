"use client";

import { useCallback, useEffect, useState } from "react";
import { useData } from "./DataProvider";

interface RunReport {
  ok: boolean;
  summary: string;
  finishedAt: string;
  errors: string[];
}
interface Status {
  channels: { channel: string; configured: boolean }[];
  anyConfigured: boolean;
  publishEnabled: boolean;
  defaultPublishChannel: string | null;
  cronSecretSet: boolean;
  lastSync: RunReport | null;
  lastPublish: RunReport | null;
}

const ALL_CHANNELS = ["LinkedIn", "Instagram", "Facebook"];

/**
 * Live status of the social sync on the Published Posts page.
 *
 * A channel counts as connected if it is either configured for the in-app
 * engine OR already has posts in the synced data (`activeChannels`) — the
 * latter covers the Make.com sync path, where posts land in Airtable without
 * any in-app token being set. This keeps the banner truthful: if data is
 * flowing for a channel, it shows as connected.
 */
export function SocialAutomationNotice({
  variant = "banner",
  activeChannels = [],
}: {
  variant?: "banner" | "empty";
  activeChannels?: string[];
}) {
  const { refresh } = useData();
  const [status, setStatus] = useState<Status | null>(null);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/social/status")
      .then((r) => r.json())
      .then((s: Status) => setStatus(s))
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => load(), [load]);

  const runSync = async () => {
    setRunning(true);
    setMsg(null);
    try {
      const res = await fetch("/api/social/sync", { method: "POST" });
      const body = (await res.json()) as RunReport & { error?: string };
      if (!res.ok && res.status !== 207) throw new Error(body.error ?? `Sync failed (${res.status})`);
      setMsg(body.summary ?? "Sync complete.");
      load();
      void refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setRunning(false);
    }
  };

  // A channel is "connected" if it has synced posts or an in-app token.
  const active = new Set(activeChannels.filter(Boolean));
  const envConfigured = new Set((status?.channels ?? []).filter((c) => c.configured).map((c) => c.channel));
  const channels = ALL_CHANNELS.map((channel) => ({
    channel,
    connected: active.has(channel) || envConfigured.has(channel),
  }));
  const connected = channels.filter((c) => c.connected).map((c) => c.channel);
  const anyConnected = connected.length > 0;
  // Only the in-app token engine can be triggered from here; the Make path syncs itself.
  const canRunInApp = Boolean(status?.anyConfigured);

  // Still waiting on the status call and nothing to show from data → render nothing.
  if (!status && active.size === 0) return null;

  return (
    <div className={variant === "empty" ? "empty" : "card"} style={{ marginBottom: variant === "empty" ? 0 : 16 }}>
      {variant === "empty" && <h3>No posts synced yet</h3>}
      <p className={variant === "empty" ? undefined : "card-title"} style={{ marginTop: 0 }}>
        {anyConnected ? `Connected: ${connected.join(", ")}.` : "No channels connected yet."}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" }}>
        {channels.map((c) => (
          <span
            key={c.channel}
            className="badge"
            title={c.connected ? "Connected" : "Not connected"}
            style={{
              background: c.connected ? "var(--ok-bg, #e6f4ea)" : "var(--warning-bg, #fdf3e0)",
              color: c.connected ? "var(--ok, #1a7f37)" : "var(--warning, #9a6700)",
            }}
          >
            {c.connected ? "● " : "○ "}
            {c.channel}
          </span>
        ))}
      </div>

      {anyConnected ? (
        <p className="card-note" style={{ marginTop: 0 }}>
          Posts and engagement for the connected channels sync into this view automatically.
          {status?.lastSync && (
            <>
              {" "}
              Last in-app sync: {status.lastSync.summary}{" "}
              <span style={{ opacity: 0.7 }}>({new Date(status.lastSync.finishedAt).toLocaleString()})</span>
            </>
          )}
        </p>
      ) : (
        <p className="card-note" style={{ marginTop: 0 }}>
          Connect a channel (in Make, or via the in-app credentials in <code>.env.example</code>) and its posts will
          populate this view. Until then, this page stays empty — no placeholder data.
        </p>
      )}

      {canRunInApp && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
          <button className="btn" onClick={runSync} disabled={running}>
            {running ? "Syncing…" : "↻ Sync now"}
          </button>
          {msg && <span className="card-note" style={{ margin: 0 }}>{msg}</span>}
        </div>
      )}
    </div>
  );
}
