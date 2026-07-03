"use client";

import { useEffect, useRef, useState } from "react";
import { useData } from "./DataProvider";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Summarize the state of the pipeline",
  "Which deals need attention right now?",
  "How is the webinar program performing?",
  "Write an executive summary of this quarter",
];

/** Executive AI assistant — streams answers grounded in the live, filtered
 *  data snapshot (same metric engine as the dashboards). */
export function Assistant() {
  const { assistantOpen, setAssistantOpen, filters } = useData();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, assistantOpen]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const history = [...messages, { role: "user" as const, content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, filters }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? `Assistant request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        const current = acc;
        setMessages([...history, { role: "assistant", content: current }]);
      }
    } catch (err) {
      setMessages([
        ...history,
        { role: "assistant", content: err instanceof Error ? err.message : "Something went wrong." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {assistantOpen && (
        <div className="assistant-panel" role="dialog" aria-label="AI assistant">
          <div className="drawer-head" style={{ padding: "12px 14px" }}>
            <div>
              <h2 style={{ fontSize: 14 }}>Executive assistant</h2>
              <div className="card-note" style={{ margin: 0 }}>
                Answers from the live snapshot, respecting your active filters
              </div>
            </div>
            <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setAssistantOpen(false)} aria-label="Close assistant">
              ✕
            </button>
          </div>
          <div className="assistant-msgs" ref={scrollRef}>
            {messages.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <p className="card-note" style={{ margin: 0 }}>Try one of these:</p>
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="btn" style={{ height: "auto", padding: "8px 12px", textAlign: "left" }} onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role === "user" ? "msg-user" : "msg-assistant"}`}>
                {m.content || (busy && i === messages.length - 1 ? "…" : "")}
              </div>
            ))}
          </div>
          <form
            className="assistant-input"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input
              className="control"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your data…"
              aria-label="Ask the assistant"
              disabled={busy}
            />
            <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>
              {busy ? "…" : "Send"}
            </button>
          </form>
        </div>
      )}
      <button className="assistant-fab" onClick={() => setAssistantOpen(!assistantOpen)} aria-label="Toggle AI assistant (Cmd+J)">
        ✦ Ask AI
      </button>
    </>
  );
}
