"use client";

import { PageState } from "@/components/PageState";
import { ContentCalendar } from "@/components/ContentCalendar";

/**
 * Content Calendar — the posting timeline. A month view of planned and
 * published content on its Post Date, colored by status; the manager-friendly
 * "what goes out when" view. Reads the Content table.
 */
export default function CalendarPage() {
  return (
    <PageState
      title="Content Calendar"
      subtitle="What goes out when — planned and published content on its post date, colored by status."
      render={(t) => <ContentCalendar records={t.content} />}
    />
  );
}
