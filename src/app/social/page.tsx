"use client";

import { PageState } from "@/components/PageState";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard, CategoryBars, Donut, TrendArea, SERIES } from "@/components/charts";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/states";
import { TABLES } from "@/lib/schema";
import { groupByOption, monthlySeries } from "@/lib/metrics";
import { fmtNumber } from "@/lib/format";
import type { MetricResult, Rec } from "@/lib/types";

/**
 * Published Posts — live social content and engagement, synced from
 * LinkedIn / Instagram / Facebook into the Social Posts table via Make.com.
 * Empty until the channel connections are wired up (see the notice below).
 */
export default function SocialPage() {
  return (
    <PageState
      title="Published Posts"
      subtitle="What actually went out on LinkedIn, Instagram, and Facebook — with live engagement, synced from each platform."
      render={(t) => {
        const posts = t.social;
        if (posts.length === 0) {
          return (
            <EmptyState
              title="No posts synced yet"
              body="Once your LinkedIn, Instagram, and Facebook accounts are connected in Make.com, published posts and their engagement land here automatically. Connect the accounts in Make → Connections, and the sync will populate this view."
            />
          );
        }

        const engagement = (r: Rec) =>
          (num(r.fields.likes) ?? 0) + (num(r.fields.comments) ?? 0) + (num(r.fields.shares) ?? 0);
        const totalEng = posts.reduce((a, r) => a + engagement(r), 0);
        const totalReach = posts.reduce((a, r) => a + (num(r.fields.reach) ?? 0), 0);

        const metrics: MetricResult[] = [
          m("posts", "Posts Published", posts.length, fmtNumber(posts.length), posts, "Count of synced posts"),
          m("engagement", "Total Engagement", totalEng, fmtNumber(totalEng), posts, "Σ (Likes + Comments + Shares)"),
          m(
            "avg-eng",
            "Avg Engagement / Post",
            posts.length ? totalEng / posts.length : 0,
            fmtNumber(posts.length ? totalEng / posts.length : 0),
            posts,
            "Total engagement ÷ posts"
          ),
          m("reach", "Total Reach", totalReach, fmtNumber(totalReach), posts, "Σ Reach across posts"),
        ];

        const byChannel = groupByOption(posts, "channel", TABLES.social.fields.channel.options!);
        const engByChannel = TABLES.social.fields.channel.options!
          .map((name) => {
            const recs = posts.filter((r) => r.fields.channel === name);
            return { name, count: recs.reduce((a, r) => a + engagement(r), 0), value: 0, records: recs };
          })
          .filter((s) => s.records.length > 0);
        const cadence = monthlySeries(posts, "published");

        return (
          <>
            <div className="grid grid-kpi">
              {metrics.map((mm) => (
                <KpiCard key={mm.id} metric={mm} />
              ))}
            </div>
            <div className="grid grid-2">
              <ChartCard
                title="Posts by channel"
                note="Where content is being published"
                legend={byChannel.map((s, i) => ({ name: s.name, color: SERIES[i % SERIES.length] }))}
              >
                <Donut data={byChannel} table="social" dimension="Channel" />
              </ChartCard>
              <ChartCard title="Engagement by channel" note="Which channel earns the most interaction">
                <CategoryBars data={engByChannel} table="social" dimension="Channel" />
              </ChartCard>
              {cadence.length > 1 && (
                <ChartCard title="Posting cadence" note="Posts published per month">
                  <TrendArea data={cadence} name="Posts" />
                </ChartCard>
              )}
            </div>
            <DataTable
              table="social"
              records={posts}
              columns={[
                "caption",
                "channel",
                "postType",
                "published",
                "likes",
                "comments",
                "shares",
                "reach",
                "impressions",
                "permalink",
              ]}
              title="All published posts"
            />
          </>
        );
      }}
    />
  );
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function m(
  id: string,
  label: string,
  raw: number,
  value: string,
  records: Rec[],
  formula: string
): MetricResult {
  return { id, label, raw, value, records, formula, table: "social" };
}
