"use client";

import { PageState } from "@/components/PageState";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard, StageFunnel, Donut, TrendArea, SERIES } from "@/components/charts";
import {
  computeExecutiveMetrics,
  groupByOption,
  monthlySeries,
  PIPELINE_STAGES,
} from "@/lib/metrics";
import { TABLES } from "@/lib/schema";

/**
 * Command Center — the single executive view. Every tile is computed by the
 * metric engine from live, filtered records; every card drills to source.
 */
export default function CommandCenter() {
  return (
    <PageState
      title="Command Center"
      subtitle="One live view across pipeline, outreach, webinars, content, and campaigns. Click any number to trace it to its source records."
      render={(t) => {
        const metrics = computeExecutiveMetrics(t);
        const stageMix = groupByOption(t.pipeline, "stage", PIPELINE_STAGES);
        const segmentMix = groupByOption(t.pipeline, "segment", TABLES.pipeline.fields.segment.options!);
        const prospectGrowth = monthlySeries(t.prospects, "dateAdded");
        const contentCadence = monthlySeries(t.content, "postDate");

        return (
          <>
            <div className="grid grid-kpi">
              {metrics.map((m) => (
                <KpiCard key={m.id} metric={m} />
              ))}
            </div>

            <div className="grid grid-2">
              <ChartCard
                title="Pipeline by stage"
                note="Deals per stage, in funnel order — click a bar to see the deals"
              >
                <StageFunnel data={stageMix} table="pipeline" dimension="Stage" />
              </ChartCard>
              <ChartCard
                title="Pipeline segment mix"
                note="Which client segments the pipeline is made of"
                legend={segmentMix.map((s, i) => ({ name: s.name, color: SERIES[i % SERIES.length] }))}
              >
                <Donut data={segmentMix} table="pipeline" dimension="Segment" />
              </ChartCard>
              {prospectGrowth.length > 1 && (
                <ChartCard title="Prospect pool growth" note="New prospects added per month">
                  <TrendArea data={prospectGrowth} name="Prospects added" />
                </ChartCard>
              )}
              {contentCadence.length > 1 && (
                <ChartCard title="Content cadence" note="Content items dated per month">
                  <TrendArea data={contentCadence} name="Content items" />
                </ChartCard>
              )}
            </div>
          </>
        );
      }}
    />
  );
}
