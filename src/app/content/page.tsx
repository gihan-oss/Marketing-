"use client";

import { PageState } from "@/components/PageState";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard, StageFunnel, CategoryBars, Donut, SERIES } from "@/components/charts";
import { DataTable } from "@/components/DataTable";
import { computeExecutiveMetrics, groupByOption, CONTENT_STAGES } from "@/lib/metrics";
import { TABLES } from "@/lib/schema";

export default function ContentPage() {
  return (
    <PageState
      title="Content & Campaigns"
      subtitle="Content production pipeline, post-type mix, and branding campaign workstreams."
      render={(t) => {
        const metrics = computeExecutiveMetrics(t).filter(
          (m) => m.table === "content" || m.table === "campaigns"
        );
        const contentFunnel = groupByOption(t.content, "status", CONTENT_STAGES);
        const typeMix = groupByOption(t.content, "postType", TABLES.content.fields.postType.options!);
        const campaignStatus = groupByOption(t.campaigns, "status", TABLES.campaigns.fields.status.options!);
        const campaignCategory = groupByOption(t.campaigns, "category", TABLES.campaigns.fields.category.options!);

        return (
          <>
            <div className="grid grid-kpi">
              {metrics.map((m) => (
                <KpiCard key={m.id} metric={m} />
              ))}
            </div>
            <div className="grid grid-2">
              <ChartCard title="Content pipeline" note="From idea pool to published, in workflow order">
                <StageFunnel data={contentFunnel} table="content" dimension="Status" />
              </ChartCard>
              <ChartCard
                title="Post type mix"
                note="What kinds of content are being produced"
                legend={typeMix.map((s, i) => ({ name: s.name, color: SERIES[i % SERIES.length] }))}
              >
                <Donut data={typeMix} table="content" dimension="Type of Post" />
              </ChartCard>
              <ChartCard title="Campaign workstreams by status" note="Branding campaign progress">
                <CategoryBars data={campaignStatus} table="campaigns" dimension="Status" />
              </ChartCard>
              <ChartCard title="Campaigns by category" note="Industry coverage of branding work">
                <CategoryBars data={campaignCategory} table="campaigns" dimension="Category" />
              </ChartCard>
            </div>
            <DataTable
              table="content"
              records={t.content}
              columns={["postIdea", "postType", "status", "postDate"]}
              title="Content items"
            />
            <DataTable
              table="campaigns"
              records={t.campaigns}
              columns={["name", "category", "status"]}
              title="Branding campaigns"
            />
          </>
        );
      }}
    />
  );
}
