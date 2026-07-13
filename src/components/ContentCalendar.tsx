"use client";

import { useMemo, useState } from "react";
import type { Rec } from "@/lib/types";
import { useData } from "./DataProvider";

/** Status → color, so the calendar reads at a glance. */
function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("published")) return "var(--ok, #1a7f37)";
  if (s.includes("scheduled")) return "var(--s6, #2f7ec4)";
  if (s === "approved") return "var(--s4, #14a3a3)";
  if (s.includes("review")) return "var(--warning, #9a6700)";
  if (s.includes("revision") || s.includes("redo")) return "var(--danger, #b3261e)";
  return "var(--muted, #8595a1)";
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Content Calendar — a month view of planned/published content on its Post Date,
 * colored by status. The manager-friendly "what goes out when" timeline. Reads
 * the Content table; clicking an item opens its record for editing.
 */
export function ContentCalendar({ records }: { records: Rec[] }) {
  const { setDrawer } = useData();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11

  // Bucket content items by yyyy-mm-dd of their Post Date.
  const byDay = useMemo(() => {
    const map = new Map<string, Rec[]>();
    for (const r of records) {
      const raw = r.fields.postDate;
      if (!raw) continue;
      const d = new Date(String(raw));
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      (map.get(key) ?? map.set(key, []).get(key)!).push(r);
    }
    return map;
  }, [records]);

  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: startDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const step = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const isToday = (day: number) =>
    day === now.getDate() && month === now.getMonth() && year === now.getFullYear();

  return (
    <section className="card" aria-label="Content calendar" style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <p className="card-title" style={{ margin: 0, flex: 1 }}>
          {MONTHS[month]} {year}
        </p>
        <button className="btn" onClick={() => step(-1)} aria-label="Previous month">←</button>
        <button className="btn" onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}>Today</button>
        <button className="btn" onClick={() => step(1)} aria-label="Next month">→</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {DOW.map((d) => (
          <div key={d} className="card-note" style={{ textAlign: "center", margin: 0, fontWeight: 600 }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          const items = day ? byDay.get(`${year}-${month}-${day}`) ?? [] : [];
          return (
            <div
              key={i}
              style={{
                minHeight: 96,
                border: "1px solid var(--grid)",
                borderRadius: 8,
                padding: 6,
                background: day ? "var(--panel, transparent)" : "transparent",
                opacity: day ? 1 : 0.35,
                outline: day && isToday(day) ? "2px solid var(--s6, #2f7ec4)" : "none",
              }}
            >
              {day && (
                <div className="card-note" style={{ margin: "0 0 4px", fontWeight: 600 }}>{day}</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {items.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setDrawer({ kind: "record", record: r })}
                    title={`${String(r.fields.postType ?? "")} · ${String(r.fields.status ?? "")}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      background: "var(--panel-2, rgba(127,127,127,0.08))",
                      borderRadius: 5,
                      padding: "3px 5px",
                      cursor: "pointer",
                      font: "inherit",
                      fontSize: 11,
                      lineHeight: "14px",
                      overflow: "hidden",
                    }}
                  >
                    <span
                      style={{
                        flex: "0 0 auto",
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        background: statusColor(String(r.fields.status ?? "")),
                      }}
                    />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {String(r.fields.postIdea ?? r.label ?? "Untitled").slice(0, 40)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="card-note" style={{ marginTop: 12 }}>
        Dot color = status: <Legend c="var(--muted)" l="Planned" /> <Legend c="var(--warning)" l="In review" />{" "}
        <Legend c="var(--s4)" l="Approved" /> <Legend c="var(--s6)" l="Scheduled" /> <Legend c="var(--ok)" l="Published" />
      </p>
    </section>
  );
}

function Legend({ c, l }: { c: string; l: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 10 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: c, display: "inline-block" }} />
      {l}
    </span>
  );
}
