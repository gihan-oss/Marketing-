import { TABLES, type TableKey } from "./schema";
import type { MetricResult, Rec } from "./types";
import { fmtCurrency, fmtNumber, fmtPercent } from "./format";

/**
 * Metric engine — the single source of truth for every KPI on the platform.
 *
 * Each metric is computed from already-filtered records, and the result
 * carries its formula description and the exact records that produced the
 * value, so every tile can drill down to source rows and deep-link into
 * Airtable. No metric is ever hardcoded.
 */

type Tables = Record<TableKey, Rec[]>;

const WON_STAGES = ["Paid Retreat", "Engagement"];
const OPEN_STAGES = ["Prospect", "Connected", "In Conversation", "Discovery Call"];
export const PIPELINE_STAGES = TABLES.pipeline.fields.stage.options!;
export const OUTREACH_STAGES = TABLES.prospects.fields.outreachStatus.options!;
export const CONTENT_STAGES = TABLES.content.fields.status.options!;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function sum(recs: Rec[], field: string): number {
  return recs.reduce((acc, r) => acc + (num(r.fields[field]) ?? 0), 0);
}

function metric(
  id: string,
  label: string,
  table: TableKey,
  records: Rec[],
  raw: number | null,
  value: string,
  formula: string,
  extra?: Partial<MetricResult>
): MetricResult {
  return { id, label, table, records, raw, value, formula, ...extra };
}

export function computeExecutiveMetrics(t: Tables): MetricResult[] {
  const todayIso = new Date().toISOString().slice(0, 10);

  const won = t.pipeline.filter((r) => WON_STAGES.includes(String(r.fields.stage)));
  const open = t.pipeline.filter((r) => OPEN_STAGES.includes(String(r.fields.stage)));
  const lost = t.pipeline.filter((r) => r.fields.stage === "Lost");
  const wonValue = sum(won, "dealValue");
  const openCount = open.length;
  const closedCount = won.length + lost.length;

  const overdue = t.pipeline.filter((r) => {
    const d = r.fields.nextActionDate;
    return typeof d === "string" && d < todayIso && OPEN_STAGES.includes(String(r.fields.stage));
  });

  const emailable = t.prospects.filter((r) => r.fields.emailStatus === "Verified");
  const replied = t.prospects.filter((r) =>
    ["Replied", "Booked"].includes(String(r.fields.outreachStatus))
  );
  const contacted = t.prospects.filter((r) =>
    ["Emailed", "Replied", "Booked", "Unsubscribed"].includes(String(r.fields.outreachStatus))
  );

  const delivered = t.webinars.filter((r) => r.fields.status === "Delivered");
  const upcoming = t.webinars.filter(
    (r) =>
      r.fields.status === "Scheduled" &&
      typeof r.fields.scheduledDate === "string" &&
      r.fields.scheduledDate >= todayIso
  );
  const totalRegs = sum(t.webinars, "registrations");
  const totalAttendees = sum(t.webinars, "attendees");

  const published = t.content.filter((r) => r.fields.status === "Published");
  const inReview = t.content.filter((r) =>
    ["Ready for Review", "Needs Revision", "Redo Required"].includes(String(r.fields.status))
  );

  const campaignsDone = t.campaigns.filter((r) => r.fields.status === "Done");
  const campaignsActive = t.campaigns.filter(
    (r) => !["Done", "Cancelled"].includes(String(r.fields.status))
  );

  return [
    metric(
      "revenue-won",
      "Revenue Won",
      "pipeline",
      won,
      wonValue,
      fmtCurrency(wonValue),
      `Sum of "Deal Value" where Stage ∈ {${WON_STAGES.join(", ")}}`,
      { hint: `${won.length} closed-won deal${won.length === 1 ? "" : "s"}`, tone: "good" }
    ),
    metric(
      "open-pipeline",
      "Open Pipeline",
      "pipeline",
      open,
      openCount,
      fmtNumber(openCount),
      `Count of deals where Stage ∈ {${OPEN_STAGES.join(", ")}}`,
      { hint: `${fmtCurrency(sum(open, "dealValue"))} in stated value` }
    ),
    metric(
      "win-rate",
      "Win Rate",
      "pipeline",
      [...won, ...lost],
      closedCount ? won.length / closedCount : null,
      closedCount ? fmtPercent(won.length / closedCount) : "—",
      `Won ÷ (Won + Lost); won = Stage ∈ {${WON_STAGES.join(", ")}}`,
      { hint: closedCount ? `${won.length} of ${closedCount} closed` : "No closed deals yet" }
    ),
    metric(
      "overdue-actions",
      "Overdue Next Actions",
      "pipeline",
      overdue,
      overdue.length,
      fmtNumber(overdue.length),
      `Open deals with "Next Action Date" before today`,
      { tone: overdue.length > 0 ? "warning" : "good", hint: overdue.length ? "Needs follow-up" : "All caught up" }
    ),
    metric(
      "prospect-pool",
      "Prospect Pool",
      "prospects",
      t.prospects,
      t.prospects.length,
      fmtNumber(t.prospects.length),
      `Count of all prospect records`,
      { hint: `${emailable.length} email-verified` }
    ),
    metric(
      "reply-rate",
      "Outreach Reply Rate",
      "prospects",
      replied,
      contacted.length ? replied.length / contacted.length : null,
      contacted.length ? fmtPercent(replied.length / contacted.length) : "—",
      `(Replied + Booked) ÷ contacted; contacted = Outreach Status ∈ {Emailed, Replied, Booked, Unsubscribed}`,
      { hint: contacted.length ? `${replied.length} of ${contacted.length} contacted` : "No outreach sent yet" }
    ),
    metric(
      "webinars-delivered",
      "Webinars Delivered",
      "webinars",
      delivered,
      delivered.length,
      fmtNumber(delivered.length),
      `Count of webinars where Webinar Status = Delivered`,
      { hint: `${upcoming.length} scheduled upcoming` }
    ),
    metric(
      "attendance-rate",
      "Webinar Attendance Rate",
      "webinars",
      t.webinars.filter((r) => num(r.fields.registrations)),
      totalRegs ? totalAttendees / totalRegs : null,
      totalRegs ? fmtPercent(totalAttendees / totalRegs) : "—",
      `Σ Attendees ÷ Σ Registrations across webinars with registrations`,
      { hint: totalRegs ? `${fmtNumber(totalAttendees)} of ${fmtNumber(totalRegs)} registered` : "No registration data yet" }
    ),
    metric(
      "content-published",
      "Content Published",
      "content",
      published,
      published.length,
      fmtNumber(published.length),
      `Count of content where Status = Published`,
      { hint: `${inReview.length} in review` }
    ),
    metric(
      "campaigns-active",
      "Active Campaign Workstreams",
      "campaigns",
      campaignsActive,
      campaignsActive.length,
      fmtNumber(campaignsActive.length),
      `Branding campaigns with Status ∉ {Done, Cancelled}`,
      { hint: `${campaignsDone.length} completed` }
    ),
  ];
}

/** Grouped counts for a singleSelect dimension, in schema option order. */
export function groupByOption(
  records: Rec[],
  fieldKey: string,
  options: string[]
): { name: string; count: number; value: number; records: Rec[] }[] {
  return options
    .map((name) => {
      const recs = records.filter((r) => r.fields[fieldKey] === name);
      return { name, count: recs.length, value: sum(recs, "dealValue"), records: recs };
    })
    .filter((g) => g.count > 0 || options.length <= 8);
}

/** Monthly time series of record counts using each table's date field. */
export function monthlySeries(records: Rec[], dateFieldKey: string): { month: string; count: number }[] {
  const byMonth = new Map<string, number>();
  for (const r of records) {
    const v = r.fields[dateFieldKey];
    if (typeof v !== "string" || v.length < 7) continue;
    const month = v.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));
}

export { WON_STAGES, OPEN_STAGES, sum };
