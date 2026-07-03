/**
 * Schema registry for the "Amal & Company Marketing" Airtable base.
 *
 * Every table ID, field ID, and select option below was read from the live
 * base schema (base appcDlJ12Cje9tUSG). This file is the single place where
 * the platform's data model is declared: pages, metrics, and filters all
 * resolve fields through it, so a rename in Airtable is a one-line fix here.
 */

export const BASE_ID = process.env.AIRTABLE_BASE_ID || "appcDlJ12Cje9tUSG";

export interface FieldDef {
  id: string;
  name: string;
  type: string;
  /** Ordered option names for singleSelect fields (order = funnel/board order). */
  options?: string[];
}

export interface TableDef {
  id: string;
  key: TableKey;
  name: string;
  description: string;
  /** Field used as the record's display label. */
  primaryField: string;
  /** Field holding the record's reference date, when one exists. */
  dateField?: string;
  fields: Record<string, FieldDef>;
}

export type TableKey =
  | "pipeline"
  | "prospects"
  | "webinars"
  | "content"
  | "campaigns"
  | "strategy"
  | "people";

export const TABLES: Record<TableKey, TableDef> = {
  pipeline: {
    id: "tblac6GRsrX6K5Qpx",
    key: "pipeline",
    name: "Sales Pipeline",
    description:
      "LinkedIn → retreats sales pipeline. One row per prospective client, moved from Prospect to Engagement.",
    primaryField: "Organization",
    dateField: "Last Touch",
    fields: {
      organization: { id: "fld1WSErvFnPAiOsO", name: "Organization", type: "singleLineText" },
      contact: { id: "fldwZT47hS8XqEdOe", name: "Contact Person", type: "singleLineText" },
      stage: {
        id: "fldoz51DYQKzs6aiJ",
        name: "Stage",
        type: "singleSelect",
        options: [
          "Prospect",
          "Connected",
          "In Conversation",
          "Discovery Call",
          "Paid Retreat",
          "Engagement",
          "Lost",
        ],
      },
      segment: {
        id: "fldybuv0sbmWTIIc5",
        name: "Segment",
        type: "singleSelect",
        options: ["Nonprofit", "Mid-size Org", "Association", "Government", "Other"],
      },
      source: {
        id: "fld4FsoHSLzFxlkjf",
        name: "Source",
        type: "singleSelect",
        options: ["LinkedIn", "Referral", "Webinar", "Newsletter", "Event", "Other"],
      },
      owner: { id: "fldt6lDYMYudiVoTW", name: "Owner", type: "singleLineText" },
      nextAction: { id: "fldSt6kfUkOH8PDtf", name: "Next Action", type: "singleLineText" },
      nextActionDate: { id: "fldgXX8v2r3EzG4DE", name: "Next Action Date", type: "date" },
      lastTouch: { id: "fldOvFxU3WeFVrttU", name: "Last Touch", type: "date" },
      dealValue: { id: "fldky4hRnPPjPhG3H", name: "Deal Value", type: "currency" },
      notes: { id: "fldtTAFRC7EyZ0h3U", name: "Notes", type: "multilineText" },
    },
  },
  prospects: {
    id: "tblBgM1DJC5BhR3V5",
    key: "prospects",
    name: "Prospects",
    description:
      "Cold-outreach prospect list sourced via Apollo/Lusha/etc. Feeds Brevo campaigns and the Sales Pipeline.",
    primaryField: "Full Name",
    dateField: "Date Added",
    fields: {
      fullName: { id: "fldTOGxFABTYskmj1", name: "Full Name", type: "singleLineText" },
      title: { id: "fld5gfklvh77KdsnY", name: "Title", type: "singleLineText" },
      organization: { id: "fld2lLiKxNhvR92Du", name: "Organization", type: "singleLineText" },
      email: { id: "flduG1rLMAL9cHsKH", name: "Email", type: "email" },
      segment: {
        id: "fldUH6UcxwDTCducW",
        name: "Segment",
        type: "singleSelect",
        options: ["Nonprofit", "Dental", "Accounting", "Association", "Healthcare", "Mid-size Org"],
      },
      region: {
        id: "fldqrczewLSaqKltq",
        name: "Region",
        type: "singleSelect",
        options: ["US", "Egypt/MENA", "Gulf", "UK/Europe"],
      },
      source: {
        id: "fldKo66GZF45CWRF7",
        name: "Source",
        type: "singleSelect",
        options: ["Apollo", "Lusha", "ZoomInfo", "Clay", "Manual", "Referral", "Event"],
      },
      emailStatus: {
        id: "fldi4eyXmc17qimtF",
        name: "Email Status",
        type: "singleSelect",
        options: ["Verified", "Unverified", "Bounced"],
      },
      outreachStatus: {
        id: "fld84sK5QEERlSkpV",
        name: "Outreach Status",
        type: "singleSelect",
        options: ["New", "Queued", "Emailed", "Replied", "Booked", "Unsubscribed", "Do Not Contact"],
      },
      dateAdded: { id: "fldudIWWzU0YcZO90", name: "Date Added", type: "date" },
      notes: { id: "fldyfCTodDCUmEocV", name: "Notes", type: "multilineText" },
    },
  },
  webinars: {
    id: "tblhlXKZYjVqRgh5Q",
    key: "webinars",
    name: "Webinars",
    description: "Webinar program: planning, delivery, promotion, and audience results.",
    primaryField: "Webinar Title",
    dateField: "Scheduled Date",
    fields: {
      title: { id: "fldhAFAyPlP4hXi3N", name: "Webinar Title", type: "singleLineText" },
      series: {
        id: "fld4DoPFiFnUFd5Hf",
        name: "Series / Theme",
        type: "singleSelect",
        options: ["Change Management", "Governance", "Leadership", "Strategy"],
      },
      webinarType: {
        id: "fldEEKwmjiPvZlMd7",
        name: "Webinar Type",
        type: "singleSelect",
        options: ["Live", "On-Demand", "Hybrid"],
      },
      status: {
        id: "fld44cCILmF5Hd50q",
        name: "Webinar Status",
        type: "singleSelect",
        options: ["Idea", "Approved", "Scheduled", "Delivered", "Archived"],
      },
      prepStatus: {
        id: "fldiJ4EEaVrZfOCbc",
        name: "Prep Status",
        type: "singleSelect",
        options: ["Not Started", "In Progress", "Ready", "Delivered"],
      },
      promotionStatus: {
        id: "fldwcWKLgWgNxIsvN",
        name: "Promotion Status",
        type: "singleSelect",
        options: ["Planned", "Live", "Closed"],
      },
      scheduledDate: { id: "fld39IVAJ9K7Jr9Y2", name: "Scheduled Date", type: "date" },
      registrations: { id: "fldctWZVWMncg8aib", name: "Registrations", type: "number" },
      attendees: { id: "fldFYL3z0To5O3tTi", name: "Attendees", type: "number" },
      attendanceRate: { id: "fldYnzrlPq2Hfp3iU", name: "Attendance Rate", type: "formula" },
      questionsAsked: { id: "fldSdCPmyERWUN9y1", name: "Questions Asked", type: "number" },
      feedbackScore: { id: "fldQHmkhVk2nuRyjy", name: "Post-Webinar Feedback Score", type: "number" },
      duration: { id: "flduIz3oOQhHngs7q", name: "Estimated Duration (min)", type: "number" },
      quarter: { id: "fldX6RPLxjFTpgXSh", name: "Quarter", type: "formula" },
      year: { id: "fldLMWFoGigeIGm2k", name: "Year", type: "formula" },
    },
  },
  content: {
    id: "tblbDRZpZ1ExdMNoM",
    key: "content",
    name: "Content",
    description: "Social/content production pipeline from idea pool to published post.",
    primaryField: "Post Idea",
    dateField: "Post Date",
    fields: {
      postDate: { id: "fldTsrOLAZC5P12l6", name: "Post Date", type: "dateTime" },
      postIdea: { id: "fldRQYV2l6hmF67mk", name: "Post Idea", type: "multilineText" },
      postType: {
        id: "fldOEi4HpfJLGhNOG",
        name: "Type of Post",
        type: "singleSelect",
        options: ["Carousel", "Reel", "Webinar", "Poll", "Event", "Testimonial", "Reel + Script", "Post"],
      },
      status: {
        id: "fldOq3GAut4RP7idc",
        name: "Status",
        type: "singleSelect",
        options: [
          "Idea Pool",
          'In Progress "Draft only"',
          "Ready for Review",
          "Needs Revision",
          "Redo Required",
          "Approved",
          "Scheduled to be published",
          "Published",
        ],
      },
    },
  },
  campaigns: {
    id: "tblGSNVfGTCBXee3A",
    key: "campaigns",
    name: "Branding Campaigns",
    description: "Branding campaign workstreams by industry category.",
    primaryField: "Name",
    fields: {
      name: { id: "fld2VENxW1D4u7t7d", name: "Name", type: "singleLineText" },
      status: {
        id: "fldVVHWEbMRIlAhNH",
        name: "Status",
        type: "singleSelect",
        options: ["Todo", "Pending", "Needs Finalizing meeting", "Done", "Cancelled"],
      },
      category: {
        id: "fldaNDXTAIc8zHMd6",
        name: "Category",
        type: "singleSelect",
        options: [
          "Dental",
          "Accounting",
          "Real-Estate",
          "Services",
          "New Year",
          "Google Reviews & retreats",
          "Brand Awareness",
        ],
      },
    },
  },
  strategy: {
    id: "tblEa3EX9ZuLSMv6v",
    key: "strategy",
    name: "Marketing Strategy",
    description: "Top-level marketing campaigns and their completion state.",
    primaryField: "Campaign",
    fields: {
      campaign: { id: "fldhsjn2Oz3aL9AJh", name: "Campaign", type: "singleLineText" },
      status: {
        id: "fldPZNKs7oZzEOSMe",
        name: "Status",
        type: "singleSelect",
        options: ["Done", "Campaign Still Ongoing"],
      },
      notes: { id: "fldte9dXlUi6IJgZU", name: "Notes", type: "multilineText" },
    },
  },
  people: {
    id: "tblM1I334WQ7hNUOs",
    key: "people",
    name: "People",
    description: "Speakers and team members referenced by webinars.",
    primaryField: "Name",
    fields: {
      name: { id: "fldfzzumegaKCxbCE", name: "Name", type: "singleLineText" },
      role: { id: "fldkomW0LpZyJu57w", name: "Role", type: "singleLineText" },
      email: { id: "fld7SVERUFkMcbHSo", name: "Email", type: "email" },
    },
  },
};

export const TABLE_KEYS = Object.keys(TABLES) as TableKey[];

/** Deep link to a record in Airtable — every metric stays traceable to source. */
export function airtableRecordUrl(tableKey: TableKey, recordId: string): string {
  return `https://airtable.com/${BASE_ID}/${TABLES[tableKey].id}/${recordId}`;
}
