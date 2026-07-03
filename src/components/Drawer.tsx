"use client";

import { useMemo } from "react";
import { TABLES, airtableRecordUrl } from "@/lib/schema";
import type { Rec } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { useData } from "./DataProvider";

/**
 * Universal drill-down drawer.
 *  - Metric view: definition + formula + the source records behind the number.
 *  - Record view: every field of one record + audit info + Airtable deep link.
 */
export function Drawer() {
  const { drawer, setDrawer } = useData();
  if (!drawer) return null;

  return (
    <>
      <div className="drawer-overlay" onClick={() => setDrawer(null)} aria-hidden />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Details panel">
        {drawer.kind === "record" ? (
          <RecordView record={drawer.record} onClose={() => setDrawer(null)} />
        ) : (
          <RecordsView
            title={drawer.kind === "metric" ? drawer.metric.label : drawer.title}
            formula={drawer.kind === "metric" ? drawer.metric.formula : drawer.formula}
            value={drawer.kind === "metric" ? drawer.metric.value : undefined}
            table={drawer.kind === "metric" ? drawer.metric.table : drawer.table}
            records={drawer.kind === "metric" ? drawer.metric.records : drawer.records}
            onClose={() => setDrawer(null)}
          />
        )}
      </aside>
    </>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button className="btn" onClick={onClose} aria-label="Close panel" style={{ marginLeft: "auto" }}>
      Esc ✕
    </button>
  );
}

function RecordsView({
  title,
  formula,
  value,
  table,
  records,
  onClose,
}: {
  title: string;
  formula?: string;
  value?: string;
  table: keyof typeof TABLES;
  records: Rec[];
  onClose: () => void;
}) {
  const { setDrawer } = useData();
  const def = TABLES[table];
  return (
    <>
      <div className="drawer-head">
        <div>
          <h2>{title}</h2>
          <div className="card-note" style={{ margin: 0 }}>
            {value ? `${value} · ` : ""}
            {records.length} source record{records.length === 1 ? "" : "s"} from “{def.name}”
          </div>
        </div>
        <CloseButton onClose={onClose} />
      </div>
      <div className="drawer-body">
        {formula && (
          <div>
            <p className="card-title">How this is calculated</p>
            <div className="formula">{formula}</div>
          </div>
        )}
        <div>
          <p className="card-title">Source records</p>
          {records.length === 0 ? (
            <p className="card-note">No records match the current filters.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {records.map((r) => (
                <div
                  key={r.id}
                  className="record-row"
                  onClick={() => setDrawer({ kind: "record", record: r })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setDrawer({ kind: "record", record: r })}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.label}
                  </span>
                  <span className="badge">{statusOf(r) ?? "view"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function statusOf(r: Rec): string | null {
  const v = r.fields.status ?? r.fields.stage ?? r.fields.outreachStatus;
  return typeof v === "string" ? v : null;
}

function RecordView({ record, onClose }: { record: Rec; onClose: () => void }) {
  const def = TABLES[record.table];
  const rows = useMemo(
    () =>
      Object.entries(def.fields)
        .map(([key, fd]) => ({ name: fd.name, value: record.fields[key], type: fd.type }))
        .filter((row) => row.value !== null && row.value !== ""),
    [def, record]
  );

  return (
    <>
      <div className="drawer-head">
        <div>
          <h2>{record.label}</h2>
          <div className="card-note" style={{ margin: 0 }}>
            {def.name} · created {fmtDate(record.createdTime)}
          </div>
        </div>
        <CloseButton onClose={onClose} />
      </div>
      <div className="drawer-body">
        <div className="field-list">
          {rows.map((row) => (
            <div className="row" key={row.name}>
              <span className="k">{row.name}</span>
              <span className="v">
                {row.type === "date" || row.type === "dateTime"
                  ? fmtDate(String(row.value))
                  : String(row.value)}
              </span>
            </div>
          ))}
        </div>
        <a
          className="btn"
          href={airtableRecordUrl(record.table, record.id)}
          target="_blank"
          rel="noreferrer"
          style={{ alignSelf: "flex-start" }}
        >
          Open in Airtable ↗
        </a>
      </div>
    </>
  );
}
