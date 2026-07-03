"use client";

import { PageState } from "@/components/PageState";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard, CategoryBars, Donut, SERIES } from "@/components/charts";
import { DataTable } from "@/components/DataTable";
import { computeExecutiveMetrics, groupByOption } from "@/lib/metrics";
import { TABLES } from "@/lib/schema";

export default function WebinarsPage() {
  return (
    <PageState
      title="Webinars"
      subtitle="Webinar program health: delivery status, series coverage, and audience results."
      render={(t) => {
        const metrics = computeExecutiveMetrics(t).filter((m) => m.table === "webinars");
        const statusMix = groupByOption(t.webinars, "status", TABLES.webinars.fields.status.options!);
        const seriesMix = groupByOption(t.webinars, "series", TABLES.webinars.fields.series.options!);
        const prepMix = groupByOption(t.webinars, "prepStatus", TABLES.webinars.fields.prepStatus.options!);

        return (
          <>
            <div className="grid grid-kpi">
              {metrics.map((m) => (
                <KpiCard key={m.id} metric={m} />
              ))}
            </div>
            <div className="grid grid-2">
              <ChartCard title="Webinars by status" note="Idea → Approved → Scheduled → Delivered">
                <CategoryBars data={statusMix} table="webinars" dimension="Webinar Status" />
              </ChartCard>
              <ChartCard
                title="Series coverage"
                note="How the program spreads across themes"
                legend={seriesMix.map((s, i) => ({ name: s.name, color: SERIES[i % SERIES.length] }))}
              >
                <Donut data={seriesMix} table="webinars" dimension="Series / Theme" />
              </ChartCard>
              <ChartCard title="Prep status" note="Readiness across the slate">
                <CategoryBars data={prepMix} table="webinars" dimension="Prep Status" />
              </ChartCard>
            </div>
            <DataTable
              table="webinars"
              records={t.webinars}
              columns={[
                "title",
                "series",
                "webinarType",
                "status",
                "prepStatus",
                "promotionStatus",
                "scheduledDate",
                "registrations",
                "attendees",
                "questionsAsked",
                "feedbackScore",
              ]}
              title="All webinars"
            />
          </>
        );
      }}
    />
  );
}
