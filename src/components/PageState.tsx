"use client";

import type { ReactNode } from "react";
import { useData } from "./DataProvider";
import { ErrorBanner, SetupNotice, SkeletonGrid } from "./states";
import type { Rec } from "@/lib/types";
import type { TableKey } from "@/lib/schema";

/**
 * Shared page gate: renders skeletons while loading, the setup notice when
 * Airtable isn't configured, an error banner on fetch failure, and otherwise
 * hands the filtered tables to the page renderer.
 */
export function PageState({
  title,
  subtitle,
  render,
}: {
  title: string;
  subtitle: string;
  render: (tables: Record<TableKey, Rec[]>) => ReactNode;
}) {
  const { snapshot, loading, tables } = useData();

  return (
    <>
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-sub">{subtitle}</p>
      </div>
      {loading || !snapshot || !tables ? (
        <>
          <SkeletonGrid count={4} />
          <SkeletonGrid count={2} h={260} />
        </>
      ) : snapshot.unconfigured ? (
        <SetupNotice />
      ) : (
        <>
          {snapshot.error && <ErrorBanner message={snapshot.error} />}
          {render(tables)}
        </>
      )}
    </>
  );
}
