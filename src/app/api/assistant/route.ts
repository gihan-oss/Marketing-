import Anthropic from "@anthropic-ai/sdk";
import { fetchSnapshot } from "@/lib/airtable";
import { filteredSnapshot } from "@/lib/filters";
import { computeExecutiveMetrics } from "@/lib/metrics";
import { TABLES, TABLE_KEYS } from "@/lib/schema";
import type { Filters } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are the executive analytics assistant for Amal & Company's marketing platform.
You answer questions about live business data: the sales pipeline, cold-outreach prospects, webinar program, content pipeline, and branding campaigns.
Ground every claim in the data snapshot provided in the conversation — cite record names and numbers from it. If the data cannot answer the question, say so plainly rather than guessing.
Be an analyst: explain what a KPI means and how it is calculated, flag anomalies (stale deals, bounced emails, overdue actions, low attendance), compare periods when dates allow, and recommend the highest-leverage next actions.
Keep answers tight and executive-ready: lead with the answer, then the supporting numbers.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured on the server." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const { messages, filters } = (await request.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
    filters?: Filters;
  };

  const snapshot = await fetchSnapshot();
  const tables = filteredSnapshot(snapshot, filters ?? {});
  const metrics = computeExecutiveMetrics(tables).map((m) => ({
    label: m.label,
    value: m.value,
    formula: m.formula,
    hint: m.hint,
  }));

  // Compact data context: KPIs plus per-table records with schema field names.
  const dataContext = {
    fetchedAt: snapshot.fetchedAt,
    activeFilters: filters ?? {},
    kpis: metrics,
    tables: Object.fromEntries(
      TABLE_KEYS.map((k) => [
        TABLES[k].name,
        tables[k].map((r) => ({ name: r.label, ...r.fields })),
      ])
    ),
  };

  const client = new Anthropic();
  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user" as const,
        content: `Current data snapshot (JSON):\n${JSON.stringify(dataContext)}`,
      },
      { role: "assistant" as const, content: "Understood. I have the current snapshot. What would you like to know?" },
      ...messages,
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
      stream.on("error", (err) => {
        controller.enqueue(encoder.encode(`\n\n[assistant error: ${err.message}]`));
        controller.close();
      });
      stream.on("end", () => controller.close());
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
