import { ACTIVE_MATCH, DELAYED_MATCH, DONE_MATCH, PENDING_MATCH, type ClientDef } from "./clients";
import type { ClientRec, ClientSnapshot } from "./types";
import { fmtNumber, fmtPercent, fmtDate } from "./format";

/** A client KPI: value + its formula + the source records that produced it. */
export interface ClientMetric {
  id: string;
  label: string;
  /** Airtable table ID the source records belong to (for drill/deep-link). */
  tableId: string;
  records: ClientRec[];
  raw: number | null;
  value: string;
  formula: string;
  hint?: string;
  tone?: "default" | "good" | "warning" | "critical";
}

/**
 * Client delivery metrics — computed live from a client's own base, adapting
 * to whichever tables/fields that client actually has (Kasper's Initiatives,
 * for example, carry no status, so status-based tiles are simply omitted).
 */

function matches(status: unknown, needles: string[]): boolean {
  if (typeof status !== "string") return false;
  const s = status.trim().toLowerCase();
  return needles.some((n) => s.includes(n));
}

export type StatusBucket = "Completed" | "On Track" | "Pending" | "Delayed" | "Other";

export function bucketOf(status: unknown): StatusBucket {
  if (matches(status, DONE_MATCH)) return "Completed";
  if (matches(status, DELAYED_MATCH)) return "Delayed";
  if (matches(status, ACTIVE_MATCH)) return "On Track";
  if (matches(status, PENDING_MATCH)) return "Pending";
  return "Other";
}

export const STATUS_BUCKETS: StatusBucket[] = ["Completed", "On Track", "Pending", "Delayed", "Other"];

function metric(m: ClientMetric): ClientMetric {
  return m;
}

/** KPI tiles for a client, computed live from that client's base. */
export function computeClientMetrics(client: ClientDef, snap: ClientSnapshot): ClientMetric[] {
  const tasks = snap.tables.tasks ?? [];
  const initiatives = snap.tables.initiatives ?? [];
  const projects = snap.tables.projects ?? [];
  const checkins = snap.tables.checkins ?? [];
  const out: ClientMetric[] = [];

  const tasksTableId = client.tables.tasks?.id ?? "";
  if (tasks.length) {
    const done = tasks.filter((t) => bucketOf(t.fields.status) === "Completed");
    const delayed = tasks.filter((t) => bucketOf(t.fields.status) === "Delayed");
    const active = tasks.filter((t) => bucketOf(t.fields.status) === "On Track");
    out.push(
      metric({
        id: "tasks-total",
        label: "Total Tasks",
        tableId: tasksTableId,
        records: tasks,
        raw: tasks.length,
        value: fmtNumber(tasks.length),
        formula: "Count of all task records",
        hint: `${active.length} on track`,
      }),
      metric({
        id: "tasks-completion",
        label: "Task Completion",
        tableId: tasksTableId,
        records: done,
        raw: tasks.length ? done.length / tasks.length : null,
        value: tasks.length ? fmtPercent(done.length / tasks.length) : "—",
        formula: "Tasks with a Completed status ÷ all tasks",
        hint: `${done.length} of ${tasks.length} done`,
        tone: "good",
      }),
      metric({
        id: "tasks-delayed",
        label: "Delayed Tasks",
        tableId: tasksTableId,
        records: delayed,
        raw: delayed.length,
        value: fmtNumber(delayed.length),
        formula: "Tasks whose status contains “Delayed”",
        tone: delayed.length ? "critical" : "good",
        hint: delayed.length ? "Needs attention" : "None delayed",
      })
    );
  }

  if (initiatives.length) {
    const hasStatus = Boolean(client.tables.initiatives?.fields.status);
    const doneInit = initiatives.filter((i) => bucketOf(i.fields.status) === "Completed");
    out.push(
      metric({
        id: "initiatives-total",
        label: "Initiatives",
        tableId: client.tables.initiatives?.id ?? "",
        records: initiatives,
        raw: initiatives.length,
        value: fmtNumber(initiatives.length),
        formula: "Count of initiative records",
        hint: hasStatus ? `${doneInit.length} completed` : undefined,
      })
    );
  }

  if (projects.length) {
    out.push(
      metric({
        id: "projects-total",
        label: "Projects",
        tableId: client.tables.projects?.id ?? "",
        records: projects,
        raw: projects.length,
        value: fmtNumber(projects.length),
        formula: "Count of project records",
      })
    );
  }

  if (checkins.length) {
    const latest = [...checkins].sort((a, b) =>
      String(b.fields.meetingDate ?? "").localeCompare(String(a.fields.meetingDate ?? ""))
    )[0];
    out.push(
      metric({
        id: "last-checkin",
        label: "Last Check-In",
        tableId: client.tables.checkins?.id ?? "",
        records: checkins,
        raw: checkins.length,
        value: latest ? fmtDate(String(latest.fields.meetingDate)) : "—",
        formula: "Most recent client check-in meeting date",
        hint: `${checkins.length} logged`,
      })
    );
  }

  return out;
}

export interface Slice {
  name: string;
  count: number;
  records: ClientRec[];
}

/** Group task records into normalized status buckets (drop empty buckets). */
export function taskStatusSlices(tasks: ClientRec[]): Slice[] {
  return STATUS_BUCKETS.map((name) => ({
    name,
    count: tasks.filter((t) => bucketOf(t.fields.status) === name).length,
    records: tasks.filter((t) => bucketOf(t.fields.status) === name),
  })).filter((s) => s.count > 0);
}

/** Group any client records by an exact singleSelect field value. */
export function sliceByField(records: ClientRec[], fieldKey: string): Slice[] {
  const map = new Map<string, ClientRec[]>();
  for (const r of records) {
    const v = r.fields[fieldKey];
    if (typeof v !== "string" || !v) continue;
    if (!map.has(v)) map.set(v, []);
    map.get(v)!.push(r);
  }
  return [...map.entries()].map(([name, recs]) => ({ name, count: recs.length, records: recs }));
}
