"use client";

import Link from "next/link";
import { PageState } from "@/components/PageState";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard, TrendArea } from "@/components/charts";
import { monthlySeries } from "@/lib/metrics";
import { fmtNumber } from "@/lib/format";
import type { MetricResult, Rec } from "@/lib/types";

/**
 * Marketing Dashboard — the single home view for the marketing team: outreach,
 * webinars, published posts, and the active client engagements. Focused on
 * marketing (no sales pipeline / task tracking). Every tile drills to source.
 */
export default function Dashboard() {
  return (
    <PageState
      title="Marketing Dashboard"
      subtitle="Outreach, webinars, and published posts at a glance — plus your active client engagements."
      render={(t) => {
        const prospects = t.prospects;
        const replied = prospects.filter((r) =>
          ["Replied", "Booked"].includes(String(r.fields.outreachStatus))
        );
        const emailed = prospects.filter((r) =>
          ["Emailed", "Replied", "Booked"].includes(String(r.fields.outreachStatus))
        );

        const webinars = t.webinars;
        const delivered = webinars.filter((r) => String(r.fields.status) === "Delivered");
        const registrations = webinars.reduce((a, r) => a + (num(r.fields.registrations) ?? 0), 0);

        const posts = t.social;
        const engagement = posts.reduce(
          (a, r) =>
            a + (num(r.fields.likes) ?? 0) + (num(r.fields.comments) ?? 0) + (num(r.fields.shares) ?? 0),
          0
        );

        const kpis: MetricResult[] = [
          m("prospects", "Prospects", "prospects", prospects.length, prospects, "People in the outreach pool"),
          m(
            "replies",
            "Replies / Booked",
            "prospects",
            replied.length,
            replied,
            "Prospects who replied or booked",
            emailed.length ? `of ${fmtNumber(emailed.length)} emailed` : undefined
          ),
          m("webinars", "Webinars Delivered", "webinars", delivered.length, delivered, "Webinars marked Delivered"),
          m("registrations", "Registrations", "webinars", registrations, webinars, "Σ registrations across webinars"),
          m("posts", "Posts Published", "social", posts.length, posts, "Synced social posts"),
          m("engagement", "Post Engagement", "social", engagement, posts, "Σ likes + comments + shares"),
        ];

        const cadence = monthlySeries(posts, "published");

        return (
          <>
            <div className="grid grid-kpi">
              {kpis.map((k) => (
                <KpiCard key={k.id} metric={k} />
              ))}
            </div>

            <section aria-label="Active clients" style={{ marginTop: 4 }}>
              <p className="card-title" style={{ margin: "0 0 10px" }}>Active Clients</p>
              <div className="grid grid-2">
                <ClientCard href="/clients/mas-gla" name="MAS GLA" note="Marketing engagement" />
                <ClientCard href="/clients/kasper" name="Kasper" note="Marketing engagement" />
              </div>
            </section>

            {cadence.length > 1 && (
              <div className="grid grid-2">
                <ChartCard title="Posting cadence" note="Posts published per month">
                  <TrendArea data={cadence} name="Posts" />
                </ChartCard>
              </div>
            )}
          </>
        );
      }}
    />
  );
}

function ClientCard({ href, name, note }: { href: string; name: string; note: string }) {
  return (
    <Link href={href} className="card" style={{ textDecoration: "none", display: "block" }}>
      <p className="card-title" style={{ margin: 0 }}>{name}</p>
      <p className="card-note" style={{ margin: "4px 0 0" }}>{note} →</p>
    </Link>
  );
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function m(
  id: string,
  label: string,
  table: MetricResult["table"],
  raw: number,
  records: Rec[],
  formula: string,
  hint?: string
): MetricResult {
  return { id, label, raw, value: fmtNumber(raw), records, formula, table, hint };
}
