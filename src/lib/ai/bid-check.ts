// AI bid check: read a sub's bid (PDF or photo) with Claude and pull out the
// line items, what's included and excluded, scope that looks missing for the
// trade, and questions to ask the sub. Runs only on the server, and only when
// the ANTHROPIC_API_KEY environment variable is set (it costs a few cents per
// bid, so it's off until the owner turns it on).
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { AiReview } from "@/lib/project/bids";

export const AI_MODEL = "claude-opus-5-5";
/** Files bigger than this are too big to send (the API takes 32 MB per request, and base64 adds a third). */
export const AI_MAX_BYTES = 20 * 1024 * 1024;
/** Bid checks allowed per project per day, so a stuck button can't run up a bill. */
export const AI_DAILY_LIMIT = 20;

export function aiBidCheckEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const ReviewSchema = z.object({
  summary: z.string().describe("Two or three plain-English sentences on what this bid covers and anything to watch."),
  total_dollars: z.number().nullable().describe("The bid's total price in dollars, or null if no total is stated."),
  line_items: z
    .array(z.object({ description: z.string(), amount_dollars: z.number().nullable() }))
    .describe("Each priced item or section in the bid. amount_dollars is null when the item has no separate price."),
  inclusions: z.array(z.string()).describe("Work and materials the bid says are included."),
  exclusions: z.array(z.string()).describe("Things the bid explicitly excludes, or says are by owner/others."),
  missing_scope: z.array(z.string()).describe("Work this trade normally covers on a new house that the bid doesn't mention."),
  questions: z.array(z.string()).describe("Questions the owner should ask the sub before signing."),
  red_flags: z.array(z.string()).describe("Terms that could cost the owner money: large deposits, vague allowances, escalation clauses, missing permit or warranty, etc."),
});

export type BidCheckInput = {
  file: { data: ArrayBuffer; contentType: string };
  trade: string;
  lineName: string;
  budgetDollars: number;
  enteredAmountDollars: number;
  otherBids: { company: string; amountDollars: number }[];
  scopeHints: string[];
};

export async function runBidCheck(input: BidCheckInput): Promise<AiReview> {
  const client = new Anthropic();
  const b64 = Buffer.from(input.file.data).toString("base64");
  const fileBlock: Anthropic.Beta.BetaContentBlockParam =
    input.file.contentType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } }
      : { type: "image", source: { type: "base64", media_type: input.file.contentType as "image/jpeg" | "image/png", data: b64 } };

  const context = [
    `Trade: ${input.trade || "unknown"}`,
    `Budget line: ${input.lineName} (owner's budget: $${Math.round(input.budgetDollars).toLocaleString("en-US")})`,
    `Amount the owner typed in for this bid: $${Math.round(input.enteredAmountDollars).toLocaleString("en-US")}`,
    input.otherBids.length
      ? `Other bids for the same line: ${input.otherBids.map((b) => `${b.company} $${Math.round(b.amountDollars).toLocaleString("en-US")}`).join("; ")}`
      : "No other bids for this line yet.",
    input.scopeHints.length ? `Work this trade usually covers on a new single-family house: ${input.scopeHints.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(ReviewSchema) },
    system:
      "You review subcontractor bids for people building their own house as an owner-builder. They are not construction professionals. " +
      "Read the attached bid carefully and report only what it actually says; never invent prices. Write short, plain sentences. " +
      "For missing scope, list only things a reasonable sub of this trade would normally include on a new single-family house that this bid doesn't mention at all.",
    messages: [
      {
        role: "user",
        content: [fileBlock, { type: "text", text: `${context}\n\nReview this bid.` }],
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error("The AI couldn't review this file.");
  const out = response.parsed_output;
  if (!out) throw new Error("The AI's answer couldn't be read. Please try again.");
  const cents = (d: number | null) => (d === null || !Number.isFinite(d) ? null : Math.round(d * 100));
  const clip = (xs: string[]) => xs.slice(0, 40).map((s) => s.slice(0, 500));
  return {
    summary: out.summary.slice(0, 2000),
    total_cents: cents(out.total_dollars),
    line_items: out.line_items.slice(0, 100).map((l) => ({ description: l.description.slice(0, 300), amount_cents: cents(l.amount_dollars) })),
    inclusions: clip(out.inclusions),
    exclusions: clip(out.exclusions),
    missing_scope: clip(out.missing_scope),
    questions: clip(out.questions),
    red_flags: clip(out.red_flags),
    model: response.model,
  };
}
