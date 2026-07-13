"use client";

import { PageState } from "@/components/PageState";
import { ProductionBoard } from "@/components/ProductionBoard";

/**
 * Content Production — the creation pipeline as a board: Ideas → Scripting →
 * Review → Approved → Scheduled → Published. Click a card to open it and move
 * it along (Status and Type are inline-editable in the drawer).
 */
export default function ProductionPage() {
  return (
    <PageState
      title="Content Production"
      subtitle="From idea to published — move each piece through scripting, review, approval, and scheduling."
      render={(t) => <ProductionBoard records={t.content} />}
    />
  );
}
