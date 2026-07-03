"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useData } from "./DataProvider";
import { Drawer } from "./Drawer";
import { Assistant } from "./Assistant";
import { EmailComposer } from "./EmailComposer";
import { dimensionValues, activeFilterCount } from "@/lib/filters";
import { fmtDate } from "@/lib/format";

const NAV = [
  { href: "/", label: "Command Center", color: "var(--s1)" },
  { href: "/pipeline", label: "Sales Pipeline", color: "var(--s2)" },
  { href: "/prospects", label: "Outreach", color: "var(--s3)" },
  { href: "/webinars", label: "Webinars", color: "var(--s5)" },
  { href: "/content", label: "Content & Campaigns", color: "var(--s8)" },
  { href: "/social", label: "Published Posts", color: "var(--s6)" },
  { href: "/data", label: "Data Explorer", color: "var(--s7)" },
];

// Active client engagements — live delivery dashboards from each client's base.
const CLIENT_NAV = [
  { href: "/clients/mas-gla", label: "MAS GLA", color: "var(--s4)" },
  { href: "/clients/kasper", label: "Kasper", color: "var(--s6)" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();
  const withQs = (href: string) => (qs ? `${href}?${qs}` : href);

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Primary">
        <div className="sidebar-brand">
          Amal &amp; Company
          <span>Marketing Analytics</span>
        </div>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={withQs(item.href)}
            className="nav-link"
            aria-current={pathname === item.href ? "page" : undefined}
          >
            <span className="dot" style={{ background: item.color }} />
            {item.label}
          </Link>
        ))}
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            padding: "14px 10px 4px",
          }}
        >
          Active Clients
        </div>
        {CLIENT_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="nav-link"
            aria-current={pathname === item.href ? "page" : undefined}
          >
            <span className="dot" style={{ background: item.color }} />
            {item.label}
          </Link>
        ))}
        <div className="sidebar-foot">
          <div>
            <span className="kbd">⌘J</span> AI assistant
          </div>
          <div style={{ marginTop: 4 }}>
            <span className="kbd">Esc</span> close panels
          </div>
        </div>
      </nav>

      <div className="main">
        <TopBar />
        <nav className="mobile-nav" aria-label="Pages">
          {NAV.map((item) => (
            <Link key={item.href} href={withQs(item.href)} aria-current={pathname === item.href ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
          {CLIENT_NAV.map((item) => (
            <Link key={item.href} href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="page-body">{children}</main>
      </div>

      <Drawer />
      <Assistant />
      <EmailComposer />
    </div>
  );
}

function TopBar() {
  const { snapshot, filters, setFilter, clearFilters, refresh, loading } = useData();
  const [refreshing, setRefreshing] = useState(false);

  const segments = snapshot ? dimensionValues(snapshot, "segment") : [];
  const regions = snapshot ? dimensionValues(snapshot, "region") : [];
  const sources = snapshot ? dimensionValues(snapshot, "source") : [];
  const owners = snapshot ? dimensionValues(snapshot, "owner") : [];
  const nFilters = activeFilterCount(filters);

  const doRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <header className="topbar" aria-label="Global filters">
      <FilterSelect label="Segment" value={filters.segment} options={segments} onChange={(v) => setFilter("segment", v)} />
      <FilterSelect label="Region" value={filters.region} options={regions} onChange={(v) => setFilter("region", v)} />
      <FilterSelect label="Source" value={filters.source} options={sources} onChange={(v) => setFilter("source", v)} />
      <FilterSelect label="Owner" value={filters.owner} options={owners} onChange={(v) => setFilter("owner", v)} />
      <input
        className="control"
        type="date"
        value={filters.from ?? ""}
        onChange={(e) => setFilter("from", e.target.value || undefined)}
        aria-label="From date"
      />
      <input
        className="control"
        type="date"
        value={filters.to ?? ""}
        onChange={(e) => setFilter("to", e.target.value || undefined)}
        aria-label="To date"
      />
      <input
        className="control"
        placeholder="Search everything…"
        value={filters.q ?? ""}
        onChange={(e) => setFilter("q", e.target.value || undefined)}
        aria-label="Global search"
        style={{ minWidth: 160 }}
      />
      {nFilters > 0 && (
        <button className="btn" onClick={clearFilters}>
          Clear filters ({nFilters})
        </button>
      )}
      <span style={{ flex: 1 }} />
      <span className="badge" title="When the data was last read from Airtable">
        {loading ? "Loading…" : snapshot ? `Data as of ${fmtDate(snapshot.fetchedAt)}` : "No data"}
      </span>
      <button className="btn" onClick={doRefresh} disabled={refreshing || loading} aria-label="Refresh data from Airtable">
        {refreshing ? "Refreshing…" : "↻ Refresh"}
      </button>
      <ThemeToggle />
    </header>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value?: string;
  options: string[];
  onChange: (v: string | undefined) => void;
}) {
  if (options.length === 0) return null;
  return (
    <select
      className="control"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      aria-label={`Filter by ${label}`}
    >
      <option value="">{label}: All</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<string>("system");

  useEffect(() => {
    setTheme(localStorage.getItem("theme") ?? "system");
  }, []);

  const apply = (next: string) => {
    setTheme(next);
    if (next === "system") {
      localStorage.removeItem("theme");
      document.documentElement.removeAttribute("data-theme");
    } else {
      localStorage.setItem("theme", next);
      document.documentElement.setAttribute("data-theme", next);
    }
  };

  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const icon = theme === "light" ? "☀️" : theme === "dark" ? "🌙" : "🖥️";
  return (
    <button className="btn" onClick={() => apply(next)} aria-label={`Theme: ${theme}. Switch to ${next}.`} title={`Theme: ${theme}`}>
      {icon}
    </button>
  );
}
