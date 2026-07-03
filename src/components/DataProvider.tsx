"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Filters, MetricResult, Rec, Snapshot } from "@/lib/types";
import { filteredSnapshot, filtersFromSearchParams, filtersToSearchParams } from "@/lib/filters";
import type { TableKey } from "@/lib/schema";

export type DrawerState =
  | { kind: "metric"; metric: MetricResult }
  | { kind: "records"; title: string; formula?: string; table: TableKey; records: Rec[] }
  | { kind: "record"; record: Rec }
  | null;

interface DataContextValue {
  snapshot: Snapshot | null;
  loading: boolean;
  refresh: () => Promise<void>;
  filters: Filters;
  setFilter: (key: keyof Filters, value: string | undefined) => void;
  clearFilters: () => void;
  /** Filter-applied records per table — what every widget consumes. */
  tables: Record<TableKey, Rec[]> | null;
  drawer: DrawerState;
  setDrawer: (d: DrawerState) => void;
  assistantOpen: boolean;
  setAssistantOpen: (open: boolean) => void;
  /** Recipients queued for the email composer, or null when it's closed. */
  composer: EmailRecipient[] | null;
  setComposer: (r: EmailRecipient[] | null) => void;
}

export interface EmailRecipient {
  recordId?: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [composer, setComposer] = useState<EmailRecipient[] | null>(null);

  const filters = useMemo(
    () => filtersFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  const load = useCallback(async (refresh = false) => {
    try {
      const res = await fetch(`/api/snapshot${refresh ? "?refresh=1" : ""}`);
      const body = (await res.json()) as Snapshot;
      setSnapshot(body);
    } catch {
      setSnapshot({
        fetchedAt: new Date().toISOString(),
        error: "Could not reach the data API.",
        tables: { pipeline: [], prospects: [], webinars: [], content: [], campaigns: [], strategy: [], people: [], social: [] },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilter = useCallback(
    (key: keyof Filters, value: string | undefined) => {
      const next = { ...filters };
      if (value) next[key] = value;
      else delete next[key];
      const sp = filtersToSearchParams(next);
      router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
    },
    [filters, pathname, router]
  );

  const clearFilters = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const tables = useMemo(
    () => (snapshot ? filteredSnapshot(snapshot, filters) : null),
    [snapshot, filters]
  );

  // Escape closes the drawer; ⌘/Ctrl+J toggles the assistant.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(null);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAssistantOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({
      snapshot,
      loading,
      refresh: () => load(true),
      filters,
      setFilter,
      clearFilters,
      tables,
      drawer,
      setDrawer,
      assistantOpen,
      setAssistantOpen,
      composer,
      setComposer,
    }),
    [snapshot, loading, load, filters, setFilter, clearFilters, tables, drawer, assistantOpen, composer]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
