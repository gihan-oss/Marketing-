"use client";

import { useState } from "react";
import type { Rec } from "@/lib/types";
import { TABLES } from "@/lib/schema";
import { useData } from "./DataProvider";
import { fmtDate } from "@/lib/format";

/**
 * Content Production board — the Content pipeline as a kanban: each column is
 * a production stage, each card a content item with its format, channel,
 * presenter, and date. Items are created right here (＋ New idea), edited via
 * the record drawer, and scripts can be emailed to the CEO for approval.
 */
const STAGES: { title: string; hint: string; statuses: string[]; color: string }[] = [
  { title: "Ideas", hint: "The idea pool — pick what to produce next", statuses: ["Idea Pool"], color: "var(--muted, #8595a1)" },
  { title: "Scripting & Drafting", hint: "Being written — scripts, captions, storyboards", statuses: ['In Progress "Draft only"'], color: "var(--s8, #b57edc)" },
  { title: "Review", hint: "Waiting on review or being revised", statuses: ["Ready for Review", "Needs Revision", "Redo Required"], color: "var(--warning, #9a6700)" },
  { title: "Approved", hint: "Ready to film / design / schedule", statuses: ["Approved"], color: "var(--s4, #14a3a3)" },
  { title: "Scheduled", hint: "Locked in on the calendar", statuses: ["Scheduled to be published"], color: "var(--s6, #2f7ec4)" },
  { title: "Published", hint: "Live — see Published Posts for engagement", statuses: ["Published"], color: "var(--ok, #1a7f37)" },
];

export function ProductionBoard({ records }: { records: Rec[] }) {
  const { setDrawer, refresh } = useData();
  const [creating, setCreating] = useState(false);
  const [sendFor, setSendFor] = useState<Rec | null>(null);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <p className="card-note" style={{ margin: 0, flex: 1 }}>
          Click a card to edit it (status, script, presenter…). New pieces start in <strong>Ideas</strong>.
        </p>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + New idea
        </button>
      </div>

      <div style={{ overflowX: "auto", paddingBottom: 6 }}>
        <div style={{ display: "flex", gap: 12, minWidth: 960 }}>
          {STAGES.map((stage) => {
            const items = records.filter((r) => stage.statuses.includes(String(r.fields.status)));
            return (
              <section
                key={stage.title}
                className="card"
                aria-label={stage.title}
                style={{ flex: "1 1 0", minWidth: 195, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}
              >
                <div>
                  <p className="card-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: stage.color }} />
                    {stage.title}
                    <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {items.length}</span>
                  </p>
                  <p className="card-note" style={{ margin: "2px 0 0" }}>{stage.hint}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {items.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        border: "1px solid var(--grid)",
                        borderRadius: 8,
                        background: "var(--panel-2, rgba(127,127,127,0.06))",
                        padding: "8px 10px",
                      }}
                    >
                      <button
                        onClick={() => setDrawer({ kind: "record", record: r })}
                        style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}
                      >
                        <div style={{ fontSize: 13, lineHeight: "17px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                          {String(r.fields.postIdea ?? r.label ?? "Untitled")}
                        </div>
                        <div className="card-note" style={{ margin: "6px 0 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {r.fields.postType ? <span className="badge">{String(r.fields.postType)}</span> : null}
                          {r.fields.channel ? <span className="badge">{String(r.fields.channel)}</span> : null}
                          {r.fields.presenter ? <span className="badge">🎤 {String(r.fields.presenter)}</span> : null}
                          {r.fields.postDate ? <span>{fmtDate(String(r.fields.postDate))}</span> : null}
                        </div>
                      </button>
                      {r.fields.script ? (
                        <button className="btn" style={{ marginTop: 8, fontSize: 12, padding: "3px 10px" }} onClick={() => setSendFor(r)}>
                          Send for approval
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {items.length === 0 && <p className="card-note" style={{ margin: 0, opacity: 0.7 }}>Empty</p>}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {creating && <NewIdeaDialog onClose={() => setCreating(false)} onCreated={() => void refresh()} />}
      {sendFor && <SendScriptDialog rec={sendFor} onClose={() => setSendFor(null)} />}
    </>
  );
}

const TYPE_OPTIONS = TABLES.content.fields.postType.options!;
const CHANNEL_OPTIONS = TABLES.content.fields.channel.options!;

function NewIdeaDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [idea, setIdea] = useState("");
  const [postType, setPostType] = useState(TYPE_OPTIONS[0]);
  const [channel, setChannel] = useState(CHANNEL_OPTIONS[0]);
  const [presenter, setPresenter] = useState("");
  const [postDate, setPostDate] = useState("");
  const [script, setScript] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!idea.trim()) {
      setError("Describe the idea first.");
      setState("error");
      return;
    }
    setState("saving");
    setError(null);
    try {
      const res = await fetch("/api/record", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableKey: "content",
          fields: {
            postIdea: idea,
            postType,
            channel,
            presenter: presenter || null,
            postDate: postDate || null,
            script: script || null,
            status: "Idea Pool",
          },
        }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b?.error ?? `Create failed (${res.status})`);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
      setState("error");
    }
  };

  return (
    <Dialog title="New content idea" onClose={onClose}>
      <label className="card-note">Idea *</label>
      <textarea className="control" rows={2} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="e.g. CEO reel: the 3 signs your strategy is stuck in a slide deck" style={{ width: "100%" }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 130 }}>
          <label className="card-note">Format</label>
          <select className="control" style={{ width: "100%" }} value={postType} onChange={(e) => setPostType(e.target.value)}>
            {TYPE_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 130 }}>
          <label className="card-note">Channel</label>
          <select className="control" style={{ width: "100%" }} value={channel} onChange={(e) => setChannel(e.target.value)}>
            {CHANNEL_OPTIONS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 130 }}>
          <label className="card-note">Presenter</label>
          <input className="control" style={{ width: "100%" }} value={presenter} onChange={(e) => setPresenter(e.target.value)} placeholder="CEO / team member / none" />
        </div>
        <div style={{ flex: 1, minWidth: 130 }}>
          <label className="card-note">Planned date</label>
          <input className="control" type="date" style={{ width: "100%" }} value={postDate} onChange={(e) => setPostDate(e.target.value)} />
        </div>
      </div>
      <label className="card-note">Script / outline (optional)</label>
      <textarea className="control" rows={5} value={script} onChange={(e) => setScript(e.target.value)} placeholder="Hook, key beats, CTA…" style={{ width: "100%" }} />
      {error && <div className="error-banner">{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" onClick={save} disabled={state === "saving"}>
          {state === "saving" ? "Creating…" : "Create idea"}
        </button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </Dialog>
  );
}

function SendScriptDialog({ rec, onClose }: { rec: Rec; onClose: () => void }) {
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const send = async () => {
    if (!to.includes("@")) {
      setState("error");
      setMsg("Enter the reviewer's email.");
      return;
    }
    setState("sending");
    setMsg(null);
    try {
      const res = await fetch("/api/email/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          idea: String(rec.fields.postIdea ?? rec.label),
          script: rec.fields.script ? String(rec.fields.script) : undefined,
          presenter: rec.fields.presenter ? String(rec.fields.presenter) : undefined,
          channel: rec.fields.channel ? String(rec.fields.channel) : undefined,
          postType: rec.fields.postType ? String(rec.fields.postType) : undefined,
          postDate: rec.fields.postDate ? String(rec.fields.postDate) : undefined,
          note: note || undefined,
        }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b?.error ?? `Send failed (${res.status})`);
      setState("done");
      setMsg(`Sent to ${to}.`);
    } catch (err) {
      setState("error");
      setMsg(err instanceof Error ? err.message : "Send failed");
    }
  };

  return (
    <Dialog title="Send script for approval" onClose={onClose}>
      <p className="card-note" style={{ margin: 0 }}>
        “{String(rec.fields.postIdea ?? rec.label).slice(0, 120)}”
      </p>
      <label className="card-note">Send to (e.g. the CEO)</label>
      <input className="control" type="email" style={{ width: "100%" }} value={to} onChange={(e) => setTo(e.target.value)} placeholder="ceo@amalandcompany.com" />
      <label className="card-note">Note (optional)</label>
      <textarea className="control" rows={2} style={{ width: "100%" }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Planned for next Tuesday — OK to film?" />
      {msg && (
        <p className="card-note" style={{ margin: 0, color: state === "error" ? "var(--danger, #b3261e)" : "var(--ok, #1a7f37)" }}>{msg}</p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        {state === "done" ? (
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        ) : (
          <>
            <button className="btn btn-primary" onClick={send} disabled={state === "sending"}>
              {state === "sending" ? "Sending…" : "Send"}
            </button>
            <button className="btn" onClick={onClose}>Cancel</button>
          </>
        )}
      </div>
    </Dialog>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} aria-hidden />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-head">
          <h2>{title}</h2>
          <button className="btn" style={{ marginLeft: "auto" }} onClick={onClose}>✕</button>
        </div>
        <div className="drawer-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {children}
        </div>
      </aside>
    </>
  );
}
