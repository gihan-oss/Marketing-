"use client";

import type { Rec } from "@/lib/types";
import { useData } from "./DataProvider";
import { fmtDate } from "@/lib/format";

/**
 * Content Production board — the Content pipeline as a kanban: each column is a
 * production stage, each card a content item. Clicking a card opens the record
 * drawer where Status and Type are inline-editable, so items can be moved
 * through the pipeline from here.
 *
 * Stages group the Content table's raw statuses so the board stays readable.
 */
const STAGES: { title: string; hint: string; statuses: string[]; color: string }[] = [
  {
    title: "Ideas",
    hint: "The idea pool — pick what to produce next",
    statuses: ["Idea Pool"],
    color: "var(--muted, #8595a1)",
  },
  {
    title: "Scripting & Drafting",
    hint: "Being written — scripts, captions, storyboards",
    statuses: ['In Progress "Draft only"'],
    color: "var(--s8, #b57edc)",
  },
  {
    title: "Review",
    hint: "Waiting on review or being revised",
    statuses: ["Ready for Review", "Needs Revision", "Redo Required"],
    color: "var(--warning, #9a6700)",
  },
  {
    title: "Approved",
    hint: "Ready to film / design / schedule",
    statuses: ["Approved"],
    color: "var(--s4, #14a3a3)",
  },
  {
    title: "Scheduled",
    hint: "Locked in on the calendar",
    statuses: ["Scheduled to be published"],
    color: "var(--s6, #2f7ec4)",
  },
  {
    title: "Published",
    hint: "Live — see Published Posts for engagement",
    statuses: ["Published"],
    color: "var(--ok, #1a7f37)",
  },
];

export function ProductionBoard({ records }: { records: Rec[] }) {
  const { setDrawer } = useData();

  return (
    <div style={{ overflowX: "auto", paddingBottom: 6 }}>
      <div style={{ display: "flex", gap: 12, minWidth: 900 }}>
        {STAGES.map((stage) => {
          const items = records.filter((r) => stage.statuses.includes(String(r.fields.status)));
          return (
            <section
              key={stage.title}
              className="card"
              aria-label={stage.title}
              style={{ flex: "1 1 0", minWidth: 190, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}
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
                  <button
                    key={r.id}
                    onClick={() => setDrawer({ kind: "record", record: r })}
                    style={{
                      textAlign: "left",
                      border: "1px solid var(--grid)",
                      borderRadius: 8,
                      background: "var(--panel-2, rgba(127,127,127,0.06))",
                      padding: "8px 10px",
                      cursor: "pointer",
                      font: "inherit",
                    }}
                  >
                    <div style={{ fontSize: 13, lineHeight: "17px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                      {String(r.fields.postIdea ?? r.label ?? "Untitled")}
                    </div>
                    <div className="card-note" style={{ margin: "6px 0 0", display: "flex", gap: 8 }}>
                      {r.fields.postType ? <span className="badge">{String(r.fields.postType)}</span> : null}
                      {r.fields.postDate ? <span>{fmtDate(String(r.fields.postDate))}</span> : null}
                    </div>
                  </button>
                ))}
                {items.length === 0 && (
                  <p className="card-note" style={{ margin: 0, opacity: 0.7 }}>Empty</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
