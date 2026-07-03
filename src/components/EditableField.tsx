"use client";

import { useState } from "react";
import type { FieldDef } from "@/lib/schema";

/**
 * Inline field editor with optimistic write-back. Renders the right control
 * for the field type (select / number / date / text), PATCHes the change to
 * /api/record, and reports the saved value up so the caller can update its
 * local snapshot without a full refetch. On failure it reverts and shows why.
 */
export function EditableField({
  source,
  tableKey,
  recordId,
  fieldKey,
  field,
  value,
  onSaved,
}: {
  source: string;
  tableKey: string;
  recordId: string;
  /** Registry key of the field (e.g. "status") — how the write API resolves it. */
  fieldKey: string;
  field: FieldDef;
  value: string | number | boolean | null;
  onSaved?: (value: string | number | null) => void;
}) {
  const [current, setCurrent] = useState<string>(value == null ? "" : String(value));
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const save = async (next: string) => {
    if (next === (value == null ? "" : String(value))) return;
    setState("saving");
    setError(null);
    try {
      const res = await fetch("/api/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          tableKey,
          recordId,
          fieldKey,
          value: next === "" ? null : next,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `Save failed (${res.status})`);
      setState("saved");
      onSaved?.(body.value ?? null);
      setTimeout(() => setState("idle"), 1200);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Save failed");
      setCurrent(value == null ? "" : String(value));
    }
  };

  const control = () => {
    if (field.type === "singleSelect" && field.options) {
      return (
        <select
          className="control"
          value={current}
          disabled={state === "saving"}
          onChange={(e) => {
            setCurrent(e.target.value);
            void save(e.target.value);
          }}
          aria-label={field.name}
        >
          <option value="">—</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o.trim()}
            </option>
          ))}
        </select>
      );
    }
    const inputType = field.type === "date" ? "date" : field.type === "number" || field.type === "currency" ? "number" : "text";
    if (field.type === "multilineText") {
      return (
        <textarea
          className="control"
          style={{ height: "auto", minHeight: 60, width: "100%", resize: "vertical" }}
          value={current}
          disabled={state === "saving"}
          onChange={(e) => setCurrent(e.target.value)}
          onBlur={(e) => void save(e.target.value)}
          aria-label={field.name}
        />
      );
    }
    return (
      <input
        className="control"
        type={inputType}
        value={current}
        disabled={state === "saving"}
        onChange={(e) => setCurrent(e.target.value)}
        onBlur={(e) => void save(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        aria-label={field.name}
      />
    );
  };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, width: "100%" }}>
      {control()}
      {state === "saving" && <span className="badge">saving…</span>}
      {state === "saved" && <span className="badge badge-good">saved</span>}
      {state === "error" && (
        <span className="badge badge-critical" title={error ?? undefined}>
          error
        </span>
      )}
    </span>
  );
}
