import type { FieldDef } from "./schema";

/**
 * Client engagement registry.
 *
 * Amal & Company's active client engagements each live in their own Airtable
 * base. This registry declares, per client, the delivery tables the platform
 * surfaces (Initiatives, Projects, Tasks, Client Check-Ins) with the real
 * table/field IDs and the select options captured from each base's schema.
 *
 * Fields marked `editable: true` can be updated inline from the platform
 * (write-back is validated against this registry server-side).
 */

export type ClientKey = "mas-gla" | "kasper";
export type ClientTableRole = "initiatives" | "projects" | "tasks" | "checkins";

export interface ClientTableDef {
  id: string;
  role: ClientTableRole;
  name: string;
  primaryField: string;
  dateField?: string;
  fields: Record<string, FieldDef>;
}

export interface ClientDef {
  key: ClientKey;
  name: string;
  baseId: string;
  /** One-line description shown under the page title. */
  blurb: string;
  tables: Partial<Record<ClientTableRole, ClientTableDef>>;
}

// Status option groups shared by the KPI normalizer (see clientMetrics.ts).
export const DONE_MATCH = ["complete", "implemented", "monitored"];
export const DELAYED_MATCH = ["delayed"];
export const PENDING_MATCH = ["pending", "open", "not started"];
export const ACTIVE_MATCH = ["on track", "in progress", "ongoing"];

export const CLIENTS: Record<ClientKey, ClientDef> = {
  "mas-gla": {
    key: "mas-gla",
    name: "MAS GLA",
    baseId: "appHhvQGW7QaDroW8",
    blurb: "Transformation engagement — discovery, initiatives, projects, and weekly delivery.",
    tables: {
      initiatives: {
        id: "tblKkoIZKxhzIPm6w",
        role: "initiatives",
        name: "Initiatives",
        primaryField: "Initiatives",
        dateField: "Start Date",
        fields: {
          name: { id: "fldIcOtzvDdQzbxAh", name: "Initiatives", type: "singleLineText" },
          objective: { id: "fldj4HBgR5HPpNo9m", name: "Objective", type: "multilineText", editable: true },
          status: {
            id: "fldH6GC9d4ZAuYK5K",
            name: "Status",
            type: "singleSelect",
            editable: true,
            options: ["Pending To Start", "On Track", "Completed", "Delayed "],
          },
          areasOfFocus: {
            id: "fldl6TGhhsHpcfJdI",
            name: "Areas Of Focus",
            type: "singleSelect",
            editable: true,
            options: ["Happy Informed Investor", "Operational Excellence"],
          },
          startDate: { id: "fldfWDGSZazPbU7jM", name: "Start Date", type: "date", editable: true },
          endDate: { id: "fldKLInBBfsYRIa6f", name: "End Date", type: "date", editable: true },
        },
      },
      projects: {
        id: "tblcYZtrFxoG3bzz7",
        role: "projects",
        name: "Projects",
        primaryField: "Project",
        dateField: "Start date",
        fields: {
          name: { id: "fldeayHmVT3ZbzkBo", name: "Project", type: "singleLineText" },
          completion: { id: "fldljPNIlGYmH6B3s", name: "Completion Percentage", type: "formula" },
          completed: { id: "fldCycfpY46iNS7Rv", name: "Completed Tasks", type: "rollup" },
          onTrack: { id: "fldMRmODV1bRGBMGz", name: "On Track Tasks", type: "rollup" },
          pending: { id: "fldjpyBeJifPsoHDF", name: "Pending to Start Tasks", type: "rollup" },
          delayed: { id: "fldUhkGPADv9Mwore", name: "Delayed Tasks", type: "rollup" },
          paused: { id: "fldZWWtMA7SEwMXne", name: "Paused Tasks", type: "rollup" },
          startDate: { id: "fldNvfoaG0kPzLvgw", name: "Start date", type: "date", editable: true },
        },
      },
      tasks: {
        id: "tblShWG1lEausAgZA",
        role: "tasks",
        name: "Tasks",
        primaryField: "Task",
        dateField: "Start Date",
        fields: {
          name: { id: "fldF3yyl67DkzU8e2", name: "Task", type: "singleLineText" },
          status: {
            id: "fldBrigKRlcGTHS4t",
            name: "Status",
            type: "singleSelect",
            editable: true,
            options: [
              "Pending to Start",
              "Pending To Start",
              "In Progress",
              "On Track",
              "Paused",
              "Delayed ",
              "Completed",
            ],
          },
          category: {
            id: "fldYIXONAahGw9ZiP",
            name: "Category",
            type: "singleSelect",
            editable: true,
            options: ["Finance", "Customer", "Operations", "HR", "Service Recipients", "Programs", "Project"],
          },
          effort: {
            id: "fldKym0PV7E83jiUa",
            name: "Effort",
            type: "singleSelect",
            editable: true,
            options: ["Low", "Mid", "High"],
          },
          impact: {
            id: "fldWKd6cOccYspyOS",
            name: "Impact",
            type: "singleSelect",
            editable: true,
            options: ["Low", "Mid", "High"],
          },
          taskType: {
            id: "fldVohsFYTAqaHGha",
            name: "Task Type",
            type: "singleSelect",
            editable: true,
            options: ["Internal", "External"],
          },
          startDate: { id: "fldlEiGK5GnV4P5WD", name: "Start Date", type: "date", editable: true },
          endDate: { id: "fldPnb76cPpYZaJPV", name: "End Date", type: "date", editable: true },
        },
      },
      checkins: {
        id: "tbls4aF9cDk2XE76J",
        role: "checkins",
        name: "Client Check-In Meeting Minutes",
        primaryField: "Meeting Date",
        dateField: "Meeting Date",
        fields: {
          meetingDate: { id: "fldPt33aJqlzYHCpW", name: "Meeting Date", type: "date" },
          completed: { id: "fldWQ3KeZBfGG6ycM", name: "Completed Tasks", type: "number" },
          ongoing: { id: "fldYNyDRNE79YgxUR", name: "On-Going Tasks", type: "number" },
          pending: { id: "fldGQYHgf9D2v9ACg", name: "Pending Tasks", type: "number" },
          delayed: { id: "fld047VtpwjG8fqQX", name: "Delayed Tasks", type: "number" },
          discussed: { id: "fldNo6MFF41mZTe5k", name: "Discussed Topics", type: "multilineText" },
          actionItems: { id: "fldIfsYRELwBTuHK0", name: "Action Items", type: "multilineText" },
        },
      },
    },
  },
  kasper: {
    key: "kasper",
    name: "Kasper",
    baseId: "appVYXrGV4Kz33OIU",
    blurb: "Delivery engagement — initiatives, projects, tasks, and client check-ins.",
    tables: {
      initiatives: {
        id: "tblY1QjZJubY8rMSi",
        role: "initiatives",
        name: "Initiatives",
        primaryField: "Initiatives",
        fields: {
          name: { id: "fldWTg4zuA7fZNXm3", name: "Initiatives", type: "singleLineText" },
        },
      },
      projects: {
        id: "tblqFr4rEui5tNZlT",
        role: "projects",
        name: "Projects",
        primaryField: "Project",
        fields: {
          name: { id: "fldsR0imUQXoBbKna", name: "Project", type: "singleLineText" },
          operationalPlan: { id: "flddESr8oo03L5YPt", name: "Operational Plan", type: "singleLineText", editable: true },
        },
      },
      tasks: {
        id: "tbl6Yoh1kB4TScGLm",
        role: "tasks",
        name: "Tasks",
        primaryField: "Task",
        dateField: "Start Date",
        fields: {
          name: { id: "fldTK09l54xJZwy0O", name: "Task", type: "singleLineText" },
          status: {
            id: "fldP8KRKQi65jjiQf",
            name: "Status",
            type: "singleSelect",
            editable: true,
            options: [
              "Open",
              "Pending Start",
              "Pending To Start",
              "In Progress",
              "On Track",
              "Paused",
              "Delayed",
              "Delayed ",
              "Completed",
            ],
          },
          impact: {
            id: "fldarFHcN96nS1YAE",
            name: "Impact",
            type: "singleSelect",
            editable: true,
            options: ["Low", "Mid", "High", "1", "2", "3", "4", "5"],
          },
          effort: {
            id: "fldYfOBPU4yxtVIGW",
            name: "Effort",
            type: "singleSelect",
            editable: true,
            options: ["Low", "Mid", "High", "1", "2", "3", "4", "5"],
          },
          taskType: {
            id: "fldH2uAYTQynp6HYM",
            name: "Task Type",
            type: "singleSelect",
            editable: true,
            options: ["Internal", "External"],
          },
          startDate: { id: "fldzlKhK4DhkurvIp", name: "Start Date", type: "date", editable: true },
          endDate: { id: "fld34DI6bMjnpM9BH", name: "End Date", type: "date", editable: true },
          description: { id: "fldhwYvdBUh84hJmN", name: "Task Description", type: "multilineText", editable: true },
        },
      },
      checkins: {
        id: "tblGLCg9bAerngxSv",
        role: "checkins",
        name: "Client Check-In",
        primaryField: "Meeting Date",
        dateField: "Meeting Date",
        fields: {
          meetingDate: { id: "fld3avEaInfYoj2bI", name: "Meeting Date", type: "date" },
          completed: { id: "fldaxvleYy956IYYy", name: "Completed Tasks", type: "number" },
          ongoing: { id: "fldcu0eRMB1yoSXGD", name: "On-Going Tasks", type: "number" },
          pending: { id: "fldUxqige6xrVL0o2", name: "Pending Tasks", type: "number" },
          delayed: { id: "fldeLzwtotd5yRQCJ", name: "Delayed Tasks", type: "number" },
          discussed: { id: "fld15ynFE1VLpvER6", name: "Discussed Topics", type: "multilineText" },
          actionItems: { id: "fldWWUzRDIq0j67wM", name: "Action Items", type: "multilineText" },
          nextSteps: { id: "flduDOsEwQbONIYlA", name: "Next Steps", type: "multilineText" },
        },
      },
    },
  },
};

export const CLIENT_KEYS = Object.keys(CLIENTS) as ClientKey[];

export function clientRecordUrl(clientKey: ClientKey, tableId: string, recordId: string): string {
  return `https://airtable.com/${CLIENTS[clientKey].baseId}/${tableId}/${recordId}`;
}
