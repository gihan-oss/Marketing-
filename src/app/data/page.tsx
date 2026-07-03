"use client";

import { useState } from "react";
import { PageState } from "@/components/PageState";
import { DataTable } from "@/components/DataTable";
import { TABLES, TABLE_KEYS, type TableKey } from "@/lib/schema";

/** Data Explorer — browse any source table with the same filters, sorting,
 *  search, CSV export, and record drill-down as everywhere else. */
export default function DataExplorerPage() {
  const [table, setTable] = useState<TableKey>("pipeline");

  return (
    <PageState
      title="Data Explorer"
      subtitle="Every table the platform is built on, unaggregated. Global filters apply here too."
      render={(t) => (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TABLE_KEYS.map((k) => (
              <button
                key={k}
                className={`btn ${k === table ? "btn-primary" : ""}`}
                onClick={() => setTable(k)}
                aria-pressed={k === table}
              >
                {TABLES[k].name} · {t[k].length}
              </button>
            ))}
          </div>
          <p className="card-note" style={{ margin: 0 }}>{TABLES[table].description}</p>
          <DataTable table={table} records={t[table]} columns={Object.keys(TABLES[table].fields)} />
        </>
      )}
    />
  );
}
