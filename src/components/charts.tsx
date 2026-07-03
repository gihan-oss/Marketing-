"use client";

import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Rec } from "@/lib/types";
import type { TableKey } from "@/lib/schema";
import { useData } from "./DataProvider";

/**
 * Chart kit. Categorical hues are assigned in the fixed validated order
 * (never cycled), marks are thin with rounded data-ends, grid/axes are
 * recessive, and every mark drills down to its source records on click.
 */

export const SERIES = [
  "var(--s1)",
  "var(--s2)",
  "var(--s3)",
  "var(--s4)",
  "var(--s5)",
  "var(--s6)",
  "var(--s7)",
  "var(--s8)",
];

const AXIS_TICK = { fill: "var(--muted)", fontSize: 11 };

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number | string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      {label != null && <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>}
      {payload.map((p) => (
        <div key={p.name}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

export function ChartCard({
  title,
  note,
  children,
  legend,
}: {
  title: string;
  note?: string;
  children: ReactNode;
  legend?: { name: string; color: string }[];
}) {
  return (
    <section className="card" aria-label={title}>
      <p className="card-title">{title}</p>
      {note && <p className="card-note">{note}</p>}
      {children}
      {legend && legend.length > 1 && (
        <div className="legend-row">
          {legend.map((l) => (
            <span className="item" key={l.name}>
              <span className="swatch" style={{ background: l.color }} />
              {l.name}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

export interface Slice {
  name: string;
  count: number;
  records: Rec[];
}

function useDrill(table: TableKey, titlePrefix: string) {
  const { setDrawer } = useData();
  return (slice: Slice) =>
    setDrawer({
      kind: "records",
      title: `${titlePrefix}: ${slice.name}`,
      table,
      records: slice.records,
      formula: `Records where the "${titlePrefix}" dimension equals “${slice.name}” under the current global filters`,
    });
}

/** Ordinal funnel: horizontal bars in stage order, single-hue ordinal ramp. */
export function StageFunnel({
  data,
  table,
  dimension,
}: {
  data: Slice[];
  table: TableKey;
  dimension: string;
}) {
  const drill = useDrill(table, dimension);
  // Ordinal ramp derived from the sequential blue scale (light bound ≥ step 250).
  const ramp = ["#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab"];
  return (
    <div style={{ width: "100%", height: Math.max(180, data.length * 38) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--grid)" />
          <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={{ stroke: "var(--axis)" }} tickLine={false} />
          <YAxis type="category" dataKey="name" width={120} tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTip />} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey="count" name="Records" radius={[0, 4, 4, 0]} barSize={18} onClick={(d) => drill(d as unknown as Slice)} cursor="pointer">
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={ramp[Math.min(i, ramp.length - 1)]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Categorical vertical bars — fixed hue order by category identity. */
export function CategoryBars({
  data,
  table,
  dimension,
  height = 220,
}: {
  data: Slice[];
  table: TableKey;
  dimension: string;
  height?: number;
}) {
  const drill = useDrill(table, dimension);
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: -16, right: 8, top: 8, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="name" tick={AXIS_TICK} axisLine={{ stroke: "var(--axis)" }} tickLine={false} interval={0} angle={data.length > 5 ? -20 : 0} textAnchor={data.length > 5 ? "end" : "middle"} height={data.length > 5 ? 52 : 28} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTip />} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey="count" name="Records" radius={[4, 4, 0, 0]} barSize={26} onClick={(d) => drill(d as unknown as Slice)} cursor="pointer">
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={SERIES[i % SERIES.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut for composition — categorical identity, 2px surface gaps. */
export function Donut({
  data,
  table,
  dimension,
  height = 220,
}: {
  data: Slice[];
  table: TableKey;
  dimension: string;
  height?: number;
}) {
  const drill = useDrill(table, dimension);
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <PieChart>
          <Tooltip content={<ChartTip />} />
          <Pie
            data={data}
            dataKey="count"
            nameKey="name"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
            stroke="var(--surface)"
            strokeWidth={2}
            onClick={(d) => drill(d as unknown as Slice)}
            cursor="pointer"
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={SERIES[i % SERIES.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Single-series trend area (2px line, subtle fill). */
export function TrendArea({
  data,
  height = 200,
  name = "Records",
}: {
  data: { month: string; count: number }[];
  height?: number;
  name?: string;
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: -16, right: 8, top: 8, bottom: 4 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--s1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--s1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="month" tick={AXIS_TICK} axisLine={{ stroke: "var(--axis)" }} tickLine={false} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTip />} cursor={{ stroke: "var(--axis)" }} />
          <Area type="monotone" dataKey="count" name={name} stroke="var(--s1)" strokeWidth={2} fill="url(#trendFill)" activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
