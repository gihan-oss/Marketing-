"use client";

import { PageState } from "@/components/PageState";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard, StageFunnel, CategoryBars, SERIES } from "@/components/charts";
import { DataTable } from "@/components/DataTable";
import { computeExecutiveMetrics, groupByOption, PIPELINE_STAGES } from "@/lib/metrics";
import { TABLES } from "@/lib/schema";

export default function PipelinePage() {
  return (
    <PageState
      title="Sales Pipeline"
      subtitle="LinkedIn → retreats pipeline: stage funnel, sources, owners, and every deal."
      render={(t) => {
        const metrics = computeExecutiveMetrics(t).filter((m) => m.table === "pipeline");
        const stageMix = groupByOption(t.pipeline, "stage", PIPELINE_STAGES);
        const sourceMix = groupByOption(t.pipeline, "source", TABLES.pipeline.fields.source.options!);

        return (
          <>
            <div className="grid grid-kpi">
              {metrics.map((m) => (
                <KpiCard key={m.id} metric={m} />
              ))}
            </div>
            <div className="grid grid-2">
              <ChartCard title="Stage funnel" note="Click a stage to inspect its deals">
                <StageFunnel data={stageMix} table="pipeline" dimension="Stage" />
              </ChartCard>
              <ChartCard
                title="Deals by source"
                note="Where pipeline is coming from"
                legend={sourceMix.map((s, i) => ({ name: s.name, color: SERIES[i % SERIES.length] }))}
              >
                <CategoryBars data={sourceMix} table="pipeline" dimension="Source" />
              </ChartCard>
            </div>
            <DataTable
              table="pipeline"
              records={t.pipeline}
              columns={[
                "organization",
                "contact",
                "stage",
                "segment",
                "source",
                "owner",
                "dealValue",
                "nextAction",
                "nextActionDate",
                "lastTouch",
              ]}
              title="All deals"
            />
          </>
        );
      }}
    />
  );
}
