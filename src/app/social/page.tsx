"use client";

import { useMemo, useState } from "react";
import { PageState } from "@/components/PageState";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard, CategoryBars, Donut, TrendArea, SERIES } from "@/components/charts";
import { SocialAutomationNotice } from "@/components/SocialAutomationNotice";
import { PostsView } from "@/components/PostsView";
import { TABLES } from "@/lib/schema";
import { groupByOption, monthlySeries } from "@/lib/metrics";
import { fmtNumber } from "@/lib/format";
import type { MetricResult, Rec } from "@/lib/types";

/**
 * Published Posts — live social content and engagement synced from
 * LinkedIn / Instagram / Facebook. Defaults to the most recent month with
 * posts; the month selector reveals any other month (or everything).
 */
export default function SocialPage() {
  return (
    <PageState
      title="Published Posts"
      subtitle="What actually went out on LinkedIn, Instagram, and Facebook — with live engagement, synced from each platform."
      render={(t) =>
        t.social.length === 0 ? <SocialAutomationNotice variant="empty" /> : <SocialBody posts={t.social} />
      }
    />
  );
}

function monthOf(r: Rec): string {
  return String(r.fields.published ?? "").slice(0, 7);
}

function monthLabel(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  if (!y || !mo) return m;
  return new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function SocialBody({ posts }: { posts: Rec[] }) {
  // Months present in the data, newest first. Default view = latest month.
  const months = useMemo(
    () => Array.from(new Set(posts.map(monthOf).filter(Boolean))).sort().reverse(),
    [posts]
  );
  const [month, setMonth] = useState<string>(months[0] ?? "all");
  const active = months.includes(month) ? month : "all";
  const shown = active === "all" ? posts : posts.filter((r) => monthOf(r) === active);

  const engagement = (r: Rec) =>
    (num(r.fields.likes) ?? 0) + (num(r.fields.comments) ?? 0) + (num(r.fields.shares) ?? 0);
  const totalEng = shown.reduce((a, r) => a + engagement(r), 0);
  const totalReach = shown.reduce((a, r) => a + (num(r.fields.reach) ?? 0), 0);

  const metrics: MetricResult[] = [
    m("posts", "Posts Published", shown.length, fmtNumber(shown.length), shown, "Count of synced posts in view"),
    m("engagement", "Total Engagement", totalEng, fmtNumber(totalEng), shown, "Σ (Likes + Comments + Shares)"),
    m(
      "avg-eng",
      "Avg Engagement / Post",
      shown.length ? totalEng / shown.length : 0,
      fmtNumber(shown.length ? totalEng / shown.length : 0),
      shown,
      "Total engagement ÷ posts"
    ),
    m("reach", "Total Reach", totalReach, fmtNumber(totalReach), shown, "Σ Reach across posts"),
  ];

  const byChannel = groupByOption(shown, "channel", TABLES.social.fields.channel.options!);
  const engByChannel = TABLES.social.fields.channel.options!
    .map((name) => {
      const recs = shown.filter((r) => r.fields.channel === name);
      return { name, count: recs.reduce((a, r) => a + engagement(r), 0), value: 0, records: recs };
    })
    .filter((s) => s.records.length > 0);
  // Cadence is always computed across ALL posts so the trend stays visible.
  const cadence = monthlySeries(posts, "published");

  const activeChannels = Array.from(new Set(posts.map((p) => String(p.fields.channel)).filter(Boolean)));

  return (
    <>
      <SocialAutomationNotice activeChannels={activeChannels} />

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <label className="card-note" style={{ margin: 0 }} htmlFor="month-select">
          Showing
        </label>
        <select
          id="month-select"
          className="control"
          value={active}
          onChange={(e) => setMonth(e.target.value)}
          aria-label="Filter posts by month"
        >
          {months.map((mo) => (
            <option key={mo} value={mo}>
              {monthLabel(mo)}
            </option>
          ))}
          <option value="all">All months</option>
        </select>
        <span className="card-note" style={{ margin: 0 }}>
          {shown.length} post{shown.length === 1 ? "" : "s"}
          {active !== "all" && posts.length !== shown.length ? ` · ${posts.length} total synced` : ""}
        </span>
      </div>

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
          <ChartCard title="Posting cadence" note="Posts published per month — all time">
            <TrendArea data={cadence} name="Posts" />
          </ChartCard>
        )}
      </div>
      <PostsView posts={shown} />
    </>
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
