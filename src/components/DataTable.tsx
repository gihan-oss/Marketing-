"use client";

import { useMemo, useState } from "react";
import { TABLES, type TableKey } from "@/lib/schema";
import type { Rec } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { useData } from "./DataProvider";
import { EmptyState } from "./states";

/**
 * Enterprise data table over normalized records: column sorting, quick
 * search, CSV export, and row click → record drill-down drawer.
 */
export function DataTable({
  table,
  records,
  columns,
  title,
}: {
  table: TableKey;
  records: Rec[];
  /** Field keys (from the schema registry) to show, in order. */
  columns: string[];
  title?: string;
}) {
  const { setDrawer } = useData();
  const def = TABLES[table];
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [query, setQuery] = useState("");

  const cols = columns.filter((c) => c in def.fields);

  const rows = useMemo(() => {
    let out = records;
    if (query) {
      const q = query.toLowerCase();
      out = out.filter((r) =>
        `${r.label} ${cols.map((c) => r.fields[c] ?? "").join(" ")}`.toLowerCase().includes(q)
      );
    }
    if (sort) {
      out = [...out].sort((a, b) => {
        const av = a.fields[sort.key];
        const bv = b.fields[sort.key];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * sort.dir;
        return String(av).localeCompare(String(bv)) * sort.dir;
      });
    }
    return out;
  }, [records, query, sort, cols]);

  const exportCsv = () => {
    const header = cols.map((c) => def.fields[c].name);
    const lines = [header, ...rows.map((r) => cols.map((c) => csvCell(r.fields[c])))]
      .map((cells) => cells.join(","))
      .join("\n");
    const blob = new Blob([lines], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${def.name.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card" aria-label={title ?? def.name} style={{ padding: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", flexWrap: "wrap" }}>
        <p className="card-title" style={{ margin: 0, flex: 1 }}>
          {title ?? def.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {rows.length} rows</span>
        </p>
        <input
          className="control"
          placeholder="Search rows…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={`Search ${def.name}`}
        />
        <button className="btn" onClick={exportCsv} disabled={rows.length === 0}>
          Export CSV
        </button>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: "0 14px 14px" }}>
          <EmptyState title="No rows" body="Nothing matches the current filters or search." />
        </div>
      ) : (
        <div className="table-wrap" style={{ border: "none", borderTop: `1px solid var(--grid)`, borderRadius: 0 }}>
          <table className="data">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th
                    key={c}
                    onClick={() =>
                      setSort((s) => (s?.key === c ? (s.dir === 1 ? { key: c, dir: -1 } : null) : { key: c, dir: 1 }))
                    }
                    aria-sort={sort?.key === c ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
                  >
                    {def.fields[c].name}
                    {sort?.key === c ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => setDrawer({ kind: "record", record: r })}>
                  {cols.map((c) => (
                    <td key={c}>{renderCell(r.fields[c], def.fields[c].type)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function renderCell(v: string | number | boolean | null, type: string): string {
  if (v == null || v === "") return "—";
  if (type === "date" || type === "dateTime") return fmtDate(String(v));
  if (type === "currency" && typeof v === "number")
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
  return String(v);
}

function csvCell(v: string | number | boolean | null): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
