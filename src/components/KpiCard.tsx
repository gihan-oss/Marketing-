"use client";

import type { MetricResult } from "@/lib/types";
import { useData } from "./DataProvider";

/** Executive KPI tile. Clicking opens the drill-down drawer with the metric's
 *  formula and the exact source records that produced the value. */
export function KpiCard({ metric }: { metric: MetricResult }) {
  const { setDrawer } = useData();
  return (
    <button
      className="kpi"
      data-tone={metric.tone ?? "default"}
      onClick={() => setDrawer({ kind: "metric", metric })}
      aria-label={`${metric.label}: ${metric.value}. Open details.`}
    >
      <div className="kpi-label">{metric.label}</div>
      <div className="kpi-value">{metric.value}</div>
      {metric.hint && <div className="kpi-hint">{metric.hint}</div>}
    </button>
  );
}
