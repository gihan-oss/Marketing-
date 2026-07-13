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

/**
 * Live status of the social automation engine: which channels are connected,
 * when the last sync ran, and a manual "Sync now" trigger. Renders on the
 * Published Posts page — both above synced posts and inside the empty state.
 */
export function SocialAutomationNotice({ variant = "banner" }: { variant?: "banner" | "empty" }) {
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

  if (!status) return null;

  const connected = status.channels.filter((c) => c.configured).map((c) => c.channel);

  return (
    <div className={variant === "empty" ? "empty" : "card"} style={{ marginBottom: variant === "empty" ? 0 : 16 }}>
      {variant === "empty" && <h3>No posts synced yet</h3>}
      <p className={variant === "empty" ? undefined : "card-title"} style={{ marginTop: 0 }}>
        {status.anyConfigured
          ? `Automation connected: ${connected.join(", ")}.`
          : "No channels connected yet."}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" }}>
        {status.channels.map((c) => (
          <span
            key={c.channel}
            className="badge"
            title={c.configured ? "Connected" : "Not connected"}
            style={{
              background: c.configured ? "var(--ok-bg, #e6f4ea)" : "var(--warning-bg, #fdf3e0)",
              color: c.configured ? "var(--ok, #1a7f37)" : "var(--warning, #9a6700)",
            }}
          >
            {c.configured ? "● " : "○ "}
            {c.channel}
          </span>
        ))}
      </div>

      {status.anyConfigured ? (
        <p className="card-note" style={{ marginTop: 0 }}>
          Posts and engagement sync automatically each day. You can also sync on demand.
          {status.lastSync && (
            <>
              {" "}
              Last sync: {status.lastSync.summary}{" "}
              <span style={{ opacity: 0.7 }}>({new Date(status.lastSync.finishedAt).toLocaleString()})</span>
            </>
          )}
        </p>
      ) : (
        <p className="card-note" style={{ marginTop: 0 }}>
          Add each channel&rsquo;s credentials to the server environment (see <code>.env.example</code>) and
          the daily sync will populate this view. Until then, this page stays empty — no placeholder data.
        </p>
      )}

      {status.anyConfigured && (
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
