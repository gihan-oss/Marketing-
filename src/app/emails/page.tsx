"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { renderOutreachEmail, type EmailDesign } from "@/lib/emailTemplate";

/**
 * Email Studio — build outreach emails on the locked Amal brand template:
 * upload a photo, edit the words, preview live, save to the design library
 * (Supabase), send yourself a test, and publish to Brevo as a real template.
 */
export default function EmailStudioPage() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [designs, setDesigns] = useState<EmailDesign[]>([]);
  const [design, setDesign] = useState<EmailDesign>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [testEmail, setTestEmail] = useState("");

  const loadDesigns = useCallback(() => {
    fetch("/api/email/designs")
      .then((r) => r.json())
      .then((b) => {
        setConfigured(Boolean(b.configured));
        setDesigns(b.designs ?? []);
      })
      .catch(() => setConfigured(false));
  }, []);
  useEffect(() => loadDesigns(), [loadDesigns]);

  const html = useMemo(() => renderOutreachEmail(design), [design]);
  const set = (k: keyof EmailDesign) => (v: string) => setDesign((d) => ({ ...d, [k]: v }));

  const upload = async (file: File) => {
    setBusy("upload");
    setMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/email/upload", { method: "POST", body: form });
      const b = await res.json();
      if (!res.ok) throw new Error(b?.error ?? `Upload failed (${res.status})`);
      setDesign((d) => ({ ...d, imageUrl: b.url }));
      setMsg({ kind: "ok", text: "Photo uploaded — it now has a permanent public link." });
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy("save");
    setMsg(null);
    try {
      const res = await fetch("/api/email/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(design),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b?.error ?? `Save failed (${res.status})`);
      setDesign(b.design);
      setMsg({ kind: "ok", text: "Saved to your design library." });
      loadDesigns();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setBusy(null);
    }
  };

  const act = async (action: "test" | "publish") => {
    setBusy(action);
    setMsg(null);
    try {
      const res = await fetch("/api/email/design-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design, action, email: testEmail || undefined }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b?.error ?? `Failed (${res.status})`);
      setMsg({
        kind: "ok",
        text:
          action === "test"
            ? `Test sent to ${testEmail}.`
            : `Published to Brevo as template #${b.templateId} — it's now selectable in the outreach composer.`,
      });
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div>
        <h1 className="page-title">Email Studio</h1>
        <p className="page-sub">
          One locked brand template — swap the photo, edit the words, save it, and publish. Images are hosted
          publicly so they load in every inbox.
        </p>
      </div>

      {configured === false && (
        <div className="empty">
          <h3>Connect Supabase to save designs & host images</h3>
          <p>
            1. Create a free project at supabase.com → 2. Storage → create a <strong>public</strong> bucket named{" "}
            <code>email-images</code> → 3. SQL editor → run the <code>email_designs</code> table script (ask me for
            it) → 4. In Vercel → Settings → Environment Variables add <code>SUPABASE_URL</code> and{" "}
            <code>SUPABASE_SERVICE_ROLE_KEY</code>, then redeploy. The editor below still previews without it — you
            just can&rsquo;t upload or save yet.
          </p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 420px) 1fr", gap: 16, alignItems: "start" }}>
        {/* Editor */}
        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p className="card-title" style={{ margin: 0 }}>Design</p>

          <Field label="Design name (internal)">
            <input className="control" style={{ width: "100%" }} value={design.name ?? ""} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. Dental outreach — March" />
          </Field>

          <Field label="Hero photo">
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
                disabled={busy === "upload" || configured === false}
              />
              {design.imageUrl && (
                <button className="btn" onClick={() => set("imageUrl")("")}>Remove photo</button>
              )}
            </div>
            {configured === false && <p className="card-note" style={{ margin: "4px 0 0" }}>Needs Supabase (see above).</p>}
          </Field>

          <Field label="Kicker (small line above the headline)">
            <input className="control" style={{ width: "100%" }} value={design.eyebrow ?? ""} onChange={(e) => set("eyebrow")(e.target.value)} placeholder="Operational Transformation" />
          </Field>
          <Field label={'Headline — use "/" for line breaks; last part is highlighted'}>
            <input className="control" style={{ width: "100%" }} value={design.headline ?? ""} onChange={(e) => set("headline")(e.target.value)} placeholder="MAKE THE / PLAN / HAPPEN." />
          </Field>
          <Field label="Sub-headline">
            <textarea className="control" rows={2} style={{ width: "100%" }} value={design.subhead ?? ""} onChange={(e) => set("subhead")(e.target.value)} />
          </Field>
          <Field label="Body message (blank line = new paragraph)">
            <textarea className="control" rows={5} style={{ width: "100%" }} value={design.body ?? ""} onChange={(e) => set("body")(e.target.value)} />
          </Field>
          <Field label="Bold question / key line">
            <textarea className="control" rows={2} style={{ width: "100%" }} value={design.question ?? ""} onChange={(e) => set("question")(e.target.value)} />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <Field label="Button text" style={{ flex: 1 }}>
              <input className="control" style={{ width: "100%" }} value={design.ctaText ?? ""} onChange={(e) => set("ctaText")(e.target.value)} placeholder="Book a 20-min discovery call →" />
            </Field>
            <Field label="Button link" style={{ flex: 1 }}>
              <input className="control" style={{ width: "100%" }} value={design.ctaUrl ?? ""} onChange={(e) => set("ctaUrl")(e.target.value)} placeholder="https://…" />
            </Field>
          </div>

          {msg && (
            <p className="card-note" style={{ margin: 0, color: msg.kind === "err" ? "var(--danger, #b3261e)" : "var(--ok, #1a7f37)" }}>
              {msg.text}
            </p>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={save} disabled={busy !== null || configured === false}>
              {busy === "save" ? "Saving…" : design.id ? "Save changes" : "Save design"}
            </button>
            <button className="btn" onClick={() => act("publish")} disabled={busy !== null}>
              {busy === "publish" ? "Publishing…" : "Publish to Brevo"}
            </button>
            <button className="btn" onClick={() => setDesign({})}>New blank design</button>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input className="control" type="email" placeholder="you@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} style={{ flex: 1, minWidth: 160 }} aria-label="Test email address" />
            <button className="btn" onClick={() => act("test")} disabled={busy !== null || !testEmail.includes("@")}>
              {busy === "test" ? "Sending…" : "Send me a test"}
            </button>
          </div>

          {designs.length > 0 && (
            <div>
              <p className="card-title" style={{ margin: "8px 0 6px" }}>Saved designs</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto" }}>
                {designs.map((d) => (
                  <button key={d.id} className="record-row" style={{ textAlign: "left", cursor: "pointer", font: "inherit", border: "none", background: "none" }} onClick={() => setDesign(d)}>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.name || d.headline || "Untitled design"}
                    </span>
                    {d.createdAt && <span className="badge">{d.createdAt.slice(0, 10)}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Live preview */}
        <section className="card" style={{ padding: 0, overflow: "hidden" }}>
          <p className="card-title" style={{ margin: 0, padding: "12px 14px" }}>Live preview</p>
          <iframe
            title="Email preview"
            srcDoc={html}
            sandbox=""
            style={{ width: "100%", height: "78vh", border: "none", borderTop: "1px solid var(--grid)", background: "#c9d3db" }}
          />
        </section>
      </div>
    </>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label className="card-note" style={{ display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}
