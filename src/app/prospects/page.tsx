"use client";

import { PageState } from "@/components/PageState";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard, StageFunnel, CategoryBars, Donut, SERIES } from "@/components/charts";
import { DataTable } from "@/components/DataTable";
import { computeExecutiveMetrics, groupByOption, OUTREACH_STAGES } from "@/lib/metrics";
import { TABLES } from "@/lib/schema";
import { useData } from "@/components/DataProvider";

export default function ProspectsPage() {
  const { setComposer } = useData();
  return (
    <PageState
      title="Outreach"
      subtitle="Cold-outreach prospect pool: verification, funnel from New to Booked, segments and regions."
      render={(t) => {
        const metrics = computeExecutiveMetrics(t).filter((m) => m.table === "prospects");
        const emailable = t.prospects.filter(
          (r) => typeof r.fields.email === "string" && r.fields.email.includes("@")
        );
        const funnel = groupByOption(t.prospects, "outreachStatus", OUTREACH_STAGES);
        const emailStatus = groupByOption(t.prospects, "emailStatus", TABLES.prospects.fields.emailStatus.options!);
        const regionMix = groupByOption(t.prospects, "region", TABLES.prospects.fields.region.options!);
        const segmentMix = groupByOption(t.prospects, "segment", TABLES.prospects.fields.segment.options!);

        return (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn btn-primary"
                disabled={emailable.length === 0}
                onClick={() =>
                  setComposer(
                    emailable.map((r) => ({
                      recordId: r.id,
                      email: String(r.fields.email),
                      name: r.label,
                      firstName: typeof r.fields.firstName === "string" ? r.fields.firstName : undefined,
                      emailStatus: typeof r.fields.emailStatus === "string" ? r.fields.emailStatus : undefined,
                    }))
                  )
                }
                title="Compose an outreach email to the prospects matching the current filters"
              >
                ✉ Email {emailable.length} filtered prospect{emailable.length === 1 ? "" : "s"}
              </button>
            </div>
            <div className="grid grid-kpi">
              {metrics.map((m) => (
                <KpiCard key={m.id} metric={m} />
              ))}
            </div>
            <div className="grid grid-2">
              <ChartCard title="Outreach funnel" note="Prospects by outreach status, in journey order">
                <StageFunnel data={funnel} table="prospects" dimension="Outreach Status" />
              </ChartCard>
              <ChartCard
                title="Email deliverability"
                note="Verified vs unverified vs bounced"
                legend={emailStatus.map((s, i) => ({ name: s.name, color: SERIES[i % SERIES.length] }))}
              >
                <Donut data={emailStatus} table="prospects" dimension="Email Status" />
              </ChartCard>
              <ChartCard title="Prospects by segment" note="Industry segments in the pool">
                <CategoryBars data={segmentMix} table="prospects" dimension="Segment" />
              </ChartCard>
              <ChartCard title="Prospects by region" note="Geographic coverage of the pool">
                <CategoryBars data={regionMix} table="prospects" dimension="Region" />
              </ChartCard>
            </div>
            <DataTable
              table="prospects"
              records={t.prospects}
              columns={[
                "fullName",
                "title",
                "organization",
                "email",
                "segment",
                "region",
                "source",
                "emailStatus",
                "outreachStatus",
                "dateAdded",
              ]}
              title="All prospects"
            />
          </>
        );
      }}
    />
  );
}
