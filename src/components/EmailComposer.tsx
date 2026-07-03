"use client";

import { useEffect, useMemo, useState } from "react";
import { useData } from "./DataProvider";

interface Template {
  id: number;
  name: string;
  subject: string;
}

/**
 * Outreach email composer. Opens over the app when recipients are queued
 * (from a prospect drawer or a bulk "email selected" action). Lets you pick
 * a Brevo template, send now or schedule, and confirms before anything goes
 * out — sending is always an explicit click here, never automatic.
 */
export function EmailComposer() {
  const { composer, setComposer, refresh } = useData();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [when, setWhen] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [result, setResult] = useState<{ sent: number; total: number; error?: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!composer) return;
    // Reset each time the composer opens.
    setState("idle");
    setResult(null);
    setConfirming(false);
    fetch("/api/email/templates")
      .then((r) => r.json())
      .then((b) => {
        setConfigured(b.configured);
        setTemplates(b.templates ?? []);
        if (b.templates?.length) setTemplateId(b.templates[0].id);
      })
      .catch(() => setTemplates([]));
  }, [composer]);

  const recipients = composer ?? [];
  const valid = useMemo(() => recipients.filter((r) => r.email && r.email.includes("@")), [recipients]);
  const chosen = templates?.find((t) => t.id === templateId);

  if (!composer) return null;

  const send = async () => {
    if (!templateId) return;
    setState("sending");
    let scheduledAt: string | undefined;
    if (mode === "schedule") {
      if (!when) {
        setState("error");
        setResult({ sent: 0, total: valid.length, error: "Pick a date & time to schedule." });
        return;
      }
      scheduledAt = new Date(when).toISOString();
    }
    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, recipients: valid, scheduledAt }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b?.error ?? `Send failed (${res.status})`);
      setResult({ sent: b.sent, total: b.total });
      setState("done");
      void refresh();
    } catch (err) {
      setResult({ sent: 0, total: valid.length, error: err instanceof Error ? err.message : "Send failed" });
      setState("error");
    }
  };

  return (
    <>
      <div className="drawer-overlay" onClick={() => setComposer(null)} aria-hidden />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Email composer">
        <div className="drawer-head">
          <div>
            <h2>Send outreach email</h2>
            <div className="card-note" style={{ margin: 0 }}>
              {valid.length} recipient{valid.length === 1 ? "" : "s"}
              {recipients.length !== valid.length && ` (${recipients.length - valid.length} without a valid email skipped)`}
            </div>
          </div>
          <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setComposer(null)}>
            Esc ✕
          </button>
        </div>

        <div className="drawer-body">
          {!configured ? (
            <div className="empty">
              <h3>Connect Brevo to send</h3>
              <p>
                Set <code>BREVO_API_KEY</code> in the server environment (Vercel → Settings → Environment
                Variables), then redeploy. Your templates and verified sender are already in Brevo.
              </p>
            </div>
          ) : state === "done" ? (
            <div className="empty">
              <h3>{mode === "schedule" ? "Scheduled" : "Sent"} ✓</h3>
              <p>
                {result?.sent} of {result?.total} email{result?.total === 1 ? "" : "s"}{" "}
                {mode === "schedule" ? "scheduled" : "sent"} via Brevo.
                {result && result.sent < result.total && " Some failed — check addresses and try again."}
              </p>
              <button className="btn btn-primary" onClick={() => setComposer(null)} style={{ marginTop: 10 }}>
                Done
              </button>
            </div>
          ) : (
            <>
              <div>
                <p className="card-title">Template</p>
                {templates === null ? (
                  <div className="skeleton" style={{ height: 32 }} />
                ) : templates.length === 0 ? (
                  <p className="card-note">No active templates found in Brevo.</p>
                ) : (
                  <select
                    className="control"
                    style={{ width: "100%" }}
                    value={templateId ?? ""}
                    onChange={(e) => setTemplateId(Number(e.target.value))}
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
                {chosen && <p className="card-note" style={{ marginTop: 6 }}>Subject: “{chosen.subject}”</p>}
              </div>

              <div>
                <p className="card-title">When</p>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <input type="radio" checked={mode === "now"} onChange={() => setMode("now")} /> Send now
                  </label>
                  <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <input type="radio" checked={mode === "schedule"} onChange={() => setMode("schedule")} /> Schedule
                  </label>
                  {mode === "schedule" && (
                    <input
                      className="control"
                      type="datetime-local"
                      value={when}
                      onChange={(e) => setWhen(e.target.value)}
                      aria-label="Scheduled date and time"
                    />
                  )}
                </div>
              </div>

              <div>
                <p className="card-title">Recipients ({valid.length})</p>
                <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                  {valid.slice(0, 50).map((r) => (
                    <div key={r.email} className="record-row" style={{ cursor: "default" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.name || r.firstName || "—"}
                      </span>
                      <span className="badge">{r.email}</span>
                    </div>
                  ))}
                  {valid.length > 50 && <p className="card-note">…and {valid.length - 50} more</p>}
                </div>
              </div>

              {result?.error && <div className="error-banner">{result.error}</div>}

              {!confirming ? (
                <button
                  className="btn btn-primary"
                  disabled={!templateId || valid.length === 0 || state === "sending"}
                  onClick={() => setConfirming(true)}
                >
                  {mode === "schedule" ? "Schedule" : "Send"} {valid.length} email{valid.length === 1 ? "" : "s"}
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="error-banner" style={{ background: "var(--warning-bg)", color: "var(--warning)", borderColor: "transparent" }}>
                    This will {mode === "schedule" ? "schedule" : "send"} a real email to {valid.length} recipient
                    {valid.length === 1 ? "" : "s"} from your verified sender. Confirm?
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary" onClick={send} disabled={state === "sending"}>
                      {state === "sending" ? "Sending…" : `Yes, ${mode === "schedule" ? "schedule" : "send"}`}
                    </button>
                    <button className="btn" onClick={() => setConfirming(false)} disabled={state === "sending"}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
