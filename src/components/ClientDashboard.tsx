"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CLIENTS, clientRecordUrl, type ClientKey, type ClientTableRole } from "@/lib/clients";
import type { ClientRec, ClientSnapshot } from "@/lib/types";
import {
  computeClientMetrics,
  sliceByField,
  taskStatusSlices,
  type Slice,
} from "@/lib/clientMetrics";
import { fmtDate } from "@/lib/format";
import { ChartCard, SERIES } from "./charts";
import { EditableField } from "./EditableField";
import { EmptyState, ErrorBanner, SetupNotice, SkeletonGrid } from "./states";

type LocalDrawer =
  | { kind: "records"; title: string; formula?: string; role: ClientTableRole; records: ClientRec[] }
  | { kind: "record"; role: ClientTableRole; record: ClientRec }
  | null;

export function ClientDashboard({ clientKey }: { clientKey: ClientKey }) {
  const client = CLIENTS[clientKey];
  const [snap, setSnap] = useState<ClientSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drawer, setDrawer] = useState<LocalDrawer>(null);

  const load = useCallback(
    async (refresh = false) => {
      const res = await fetch(`/api/client/${clientKey}${refresh ? "?refresh=1" : ""}`);
      setSnap((await res.json()) as ClientSnapshot);
      setLoading(false);
    },
    [clientKey]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Apply an edit into local state so the UI updates without a full refetch.
  const applyEdit = useCallback(
    (role: ClientTableRole, recordId: string, fieldKey: string, value: string | number | null) => {
      setSnap((prev) => {
        if (!prev) return prev;
        const rows = prev.tables[role];
        if (!rows) return prev;
        return {
          ...prev,
          tables: {
            ...prev.tables,
            [role]: rows.map((r) => (r.id === recordId ? { ...r, fields: { ...r.fields, [fieldKey]: value } } : r)),
          },
        };
      });
    },
    []
  );

  const metrics = useMemo(() => (snap ? computeClientMetrics(client, snap) : []), [client, snap]);
  const tasks = snap?.tables.tasks ?? [];
  const initiatives = snap?.tables.initiatives ?? [];
  const projects = snap?.tables.projects ?? [];

  const statusSlices = useMemo(() => taskStatusSlices(tasks), [tasks]);
  const categorySlices = useMemo(
    () => (client.tables.tasks?.fields.category ? sliceByField(tasks, "category") : []),
    [client, tasks]
  );
  const initiativeStatus = useMemo(
    () => (client.tables.initiatives?.fields.status ? sliceByField(initiatives, "status") : []),
    [client, initiatives]
  );

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <h1 className="page-title">{client.name}</h1>
          <p className="page-sub">{client.blurb}</p>
        </div>
        {snap && !snap.unconfigured && (
          <button
            className="btn"
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              await load(true);
              setRefreshing(false);
            }}
          >
            {refreshing ? "Refreshing…" : "↻ Refresh"}
          </button>
        )}
      </div>

      {loading || !snap ? (
        <>
          <SkeletonGrid count={4} />
          <SkeletonGrid count={2} h={260} />
        </>
      ) : snap.unconfigured ? (
        <SetupNotice />
      ) : (
        <>
          {snap.error && <ErrorBanner message={snap.error} />}

          <div className="grid grid-kpi">
            {metrics.map((m) => (
              <button
                key={m.id}
                className="kpi"
                data-tone={m.tone ?? "default"}
                onClick={() =>
                  setDrawer({
                    kind: "records",
                    title: m.label,
                    formula: m.formula,
                    role: roleForTableId(clientKey, m.tableId),
                    records: m.records,
                  })
                }
              >
                <div className="kpi-label">{m.label}</div>
                <div className="kpi-value">{m.value}</div>
                {m.hint && <div className="kpi-hint">{m.hint}</div>}
              </button>
            ))}
          </div>

          <div className="grid grid-2">
            {statusSlices.length > 0 && (
              <ChartCard title="Task status" note="Where the task list stands — click a bar for the tasks">
                <StatusBars slices={statusSlices} onSlice={(s) => openSlice("tasks", "Task status", s)} />
              </ChartCard>
            )}
            {initiativeStatus.length > 0 && (
              <ChartCard title="Initiative status" note="Initiatives by status">
                <StatusBars slices={initiativeStatus} onSlice={(s) => openSlice("initiatives", "Initiative status", s)} />
              </ChartCard>
            )}
            {categorySlices.length > 0 && (
              <ChartCard
                title="Tasks by category"
                note="Composition of the task list"
                legend={categorySlices.map((s, i) => ({ name: s.name, color: SERIES[i % SERIES.length] }))}
              >
                <DonutChart slices={categorySlices} onSlice={(s) => openSlice("tasks", "Tasks", s)} />
              </ChartCard>
            )}
          </div>

          {tasks.length > 0 && (
            <ClientTable
              clientKey={clientKey}
              role="tasks"
              records={tasks}
              columns={taskColumns(clientKey)}
              onRow={(r) => setDrawer({ kind: "record", role: "tasks", record: r })}
              onEdit={applyEdit}
            />
          )}
          {projects.length > 0 && (
            <ClientTable
              clientKey={clientKey}
              role="projects"
              records={projects}
              columns={Object.keys(client.tables.projects!.fields)}
              onRow={(r) => setDrawer({ kind: "record", role: "projects", record: r })}
              onEdit={applyEdit}
            />
          )}
          {initiatives.length > 0 && (
            <ClientTable
              clientKey={clientKey}
              role="initiatives"
              records={initiatives}
              columns={Object.keys(client.tables.initiatives!.fields)}
              onRow={(r) => setDrawer({ kind: "record", role: "initiatives", record: r })}
              onEdit={applyEdit}
            />
          )}
          {(snap.tables.checkins?.length ?? 0) > 0 && (
            <ClientTable
              clientKey={clientKey}
              role="checkins"
              records={snap.tables.checkins!}
              columns={Object.keys(client.tables.checkins!.fields)}
              onRow={(r) => setDrawer({ kind: "record", role: "checkins", record: r })}
              onEdit={applyEdit}
            />
          )}
        </>
      )}

      {drawer && (
        <ClientDrawer
          clientKey={clientKey}
          drawer={drawer}
          onClose={() => setDrawer(null)}
          onOpenRecord={(role, record) => setDrawer({ kind: "record", role, record })}
          onEdit={applyEdit}
        />
      )}
    </>
  );

  function openSlice(role: ClientTableRole, prefix: string, s: Slice) {
    setDrawer({
      kind: "records",
      title: `${prefix}: ${s.name}`,
      role,
      records: s.records,
      formula: `Records grouped under “${s.name}”`,
    });
  }
}

function roleForTableId(clientKey: ClientKey, tableId: string): ClientTableRole {
  const entry = Object.entries(CLIENTS[clientKey].tables).find(([, t]) => t?.id === tableId);
  return (entry?.[0] as ClientTableRole) ?? "tasks";
}

function taskColumns(clientKey: ClientKey): string[] {
  const f = CLIENTS[clientKey].tables.tasks!.fields;
  return ["name", "status", "impact", "effort", "taskType", "startDate", "endDate"].filter((k) => k in f);
}

// ---- charts -----------------------------------------------------------------

const AXIS_TICK = { fill: "var(--muted)", fontSize: 11 };
const RAMP = ["#86b6ef", "#5598e7", "#3987e5", "#2a78d6", "#1c5cab"];

function StatusBars({ slices, onSlice }: { slices: Slice[]; onSlice: (s: Slice) => void }) {
  return (
    <div style={{ width: "100%", height: Math.max(180, slices.length * 40) }}>
      <ResponsiveContainer>
        <BarChart data={slices} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--grid)" />
          <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={{ stroke: "var(--axis)" }} tickLine={false} />
          <YAxis type="category" dataKey="name" width={110} tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip />} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey="count" name="Records" radius={[0, 4, 4, 0]} barSize={20} cursor="pointer" onClick={(d) => onSlice(d as unknown as Slice)}>
            {slices.map((s, i) => (
              <Cell key={s.name} fill={RAMP[Math.min(i, RAMP.length - 1)]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DonutChart({ slices, onSlice }: { slices: Slice[]; onSlice: (s: Slice) => void }) {
  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <PieChart>
          <Tooltip content={<Tip />} />
          <Pie
            data={slices}
            dataKey="count"
            nameKey="name"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
            stroke="var(--surface)"
            strokeWidth={2}
            cursor="pointer"
            onClick={(d) => onSlice(d as unknown as Slice)}
          >
            {slices.map((s, i) => (
              <Cell key={s.name} fill={SERIES[i % SERIES.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function Tip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      {label != null && <div style={{ fontWeight: 600 }}>{label}</div>}
      {payload.map((p) => (
        <div key={p.name}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ---- table ------------------------------------------------------------------

function ClientTable({
  clientKey,
  role,
  records,
  columns,
  onRow,
  onEdit,
}: {
  clientKey: ClientKey;
  role: ClientTableRole;
  records: ClientRec[];
  columns: string[];
  onRow: (r: ClientRec) => void;
  onEdit: (role: ClientTableRole, id: string, key: string, v: string | number | null) => void;
}) {
  const table = CLIENTS[clientKey].tables[role]!;
  const cols = columns.filter((c) => c in table.fields);
  const [query, setQuery] = useState("");
  const rows = query
    ? records.filter((r) => `${r.label} ${cols.map((c) => r.fields[c] ?? "").join(" ")}`.toLowerCase().includes(query.toLowerCase()))
    : records;

  const exportCsv = () => {
    const header = cols.map((c) => table.fields[c].name);
    const lines = [header, ...rows.map((r) => cols.map((c) => csv(r.fields[c])))].map((c) => c.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([lines], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${clientKey}-${role}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="card" style={{ padding: 0 }} aria-label={table.name}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", flexWrap: "wrap" }}>
        <p className="card-title" style={{ margin: 0, flex: 1 }}>
          {table.name} <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {rows.length} rows</span>
        </p>
        <input className="control" placeholder="Search rows…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label={`Search ${table.name}`} />
        <button className="btn" onClick={exportCsv} disabled={rows.length === 0}>
          Export CSV
        </button>
      </div>
      <div className="table-wrap" style={{ border: "none", borderTop: "1px solid var(--grid)", borderRadius: 0 }}>
        <table className="data">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c}>{table.fields[c].name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {cols.map((c) => {
                  const field = table.fields[c];
                  // Inline-edit singleSelect fields directly in the cell for fast updates.
                  if (field.editable && field.type === "singleSelect") {
                    return (
                      <td key={c} onClick={(e) => e.stopPropagation()}>
                        <EditableField
                          source={clientKey}
                          tableKey={role}
                          recordId={r.id}
                          fieldKey={c}
                          field={{ ...field }}
                          value={r.fields[c]}
                          onSaved={(v) => onEdit(role, r.id, c, v)}
                        />
                      </td>
                    );
                  }
                  return (
                    <td key={c} onClick={() => onRow(r)}>
                      {renderCell(r.fields[c], field.type)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---- drawer -----------------------------------------------------------------

function ClientDrawer({
  clientKey,
  drawer,
  onClose,
  onOpenRecord,
  onEdit,
}: {
  clientKey: ClientKey;
  drawer: Exclude<LocalDrawer, null>;
  onClose: () => void;
  onOpenRecord: (role: ClientTableRole, r: ClientRec) => void;
  onEdit: (role: ClientTableRole, id: string, key: string, v: string | number | null) => void;
}) {
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} aria-hidden />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Details">
        {drawer.kind === "records" ? (
          <>
            <div className="drawer-head">
              <div>
                <h2>{drawer.title}</h2>
                <div className="card-note" style={{ margin: 0 }}>
                  {drawer.records.length} record{drawer.records.length === 1 ? "" : "s"}
                </div>
              </div>
              <button className="btn" style={{ marginLeft: "auto" }} onClick={onClose}>
                Esc ✕
              </button>
            </div>
            <div className="drawer-body">
              {drawer.formula && (
                <div>
                  <p className="card-title">How this is calculated</p>
                  <div className="formula">{drawer.formula}</div>
                </div>
              )}
              {drawer.records.length === 0 ? (
                <EmptyState title="No records" body="Nothing to show here." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {drawer.records.map((r) => (
                    <div
                      key={r.id}
                      className="record-row"
                      onClick={() => onOpenRecord(drawer.role, r)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && onOpenRecord(drawer.role, r)}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
                      <span className="badge">{String(r.fields.status ?? "view")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <RecordDetail clientKey={clientKey} role={drawer.role} record={drawer.record} onClose={onClose} onEdit={onEdit} />
        )}
      </aside>
    </>
  );
}

function RecordDetail({
  clientKey,
  role,
  record,
  onClose,
  onEdit,
}: {
  clientKey: ClientKey;
  role: ClientTableRole;
  record: ClientRec;
  onClose: () => void;
  onEdit: (role: ClientTableRole, id: string, key: string, v: string | number | null) => void;
}) {
  const table = CLIENTS[clientKey].tables[role]!;
  return (
    <>
      <div className="drawer-head">
        <div>
          <h2>{record.label}</h2>
          <div className="card-note" style={{ margin: 0 }}>
            {table.name} · created {fmtDate(record.createdTime)}
          </div>
        </div>
        <button className="btn" style={{ marginLeft: "auto" }} onClick={onClose}>
          Esc ✕
        </button>
      </div>
      <div className="drawer-body">
        <div className="field-list">
          {Object.entries(table.fields).map(([key, field]) => {
            const value = record.fields[key];
            if (field.editable) {
              return (
                <div className="row" key={key} style={{ alignItems: "center" }}>
                  <span className="k">{field.name}</span>
                  <span className="v" style={{ minWidth: 200 }}>
                    <EditableField
                      source={clientKey}
                      tableKey={role}
                      recordId={record.id}
                      fieldKey={key}
                      field={{ ...field }}
                      value={value}
                      onSaved={(v) => onEdit(role, record.id, key, v)}
                    />
                  </span>
                </div>
              );
            }
            if (value == null || value === "") return null;
            return (
              <div className="row" key={key}>
                <span className="k">{field.name}</span>
                <span className="v">{field.type === "date" ? fmtDate(String(value)) : String(value)}</span>
              </div>
            );
          })}
        </div>
        <a className="btn" href={clientRecordUrl(clientKey, record.tableId, record.id)} target="_blank" rel="noreferrer" style={{ alignSelf: "flex-start" }}>
          Open in Airtable ↗
        </a>
      </div>
    </>
  );
}

function renderCell(v: string | number | boolean | null, type: string): string {
  if (v == null || v === "") return "—";
  if (type === "date" || type === "dateTime") return fmtDate(String(v));
  return String(v);
}

function csv(v: string | number | boolean | null): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
