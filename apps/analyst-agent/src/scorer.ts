import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import type { TokenizedStock } from "@elitr/shared";
import type { Headline } from "./news.js";

export const DEFAULT_MODEL = "claude-haiku-4-5";

export interface Score {
  score: number;
  stance: "bullish" | "neutral" | "bearish";
  rationale: string;
  cited: Headline[];
}

const OUTPUT = jsonSchemaOutputFormat({
  type: "object",
  properties: {
    score: { type: "integer", description: "1 = extremely bearish, 50 = neutral, 100 = extremely bullish" },
    stance: { type: "string", enum: ["bullish", "neutral", "bearish"] },
    rationale: { type: "string", description: "2-4 sentences naming the specific headlines that drove the score" },
    citedHeadlineIds: {
      type: "array",
      items: { type: "integer" },
      description: "ids of the headlines that most influenced the score",
    },
  },
  required: ["score", "stance", "rationale", "citedHeadlineIds"],
  additionalProperties: false,
});

const SYSTEM = `You are an equity news-sentiment analyst. You receive recent news headlines about one US-listed stock and rate the short-term (next 1-3 trading days) sentiment they imply for that stock.
Judge only from the headlines provided; do not use outside knowledge about prices. Discount generic listicles and promotional pieces, weight concrete company news (earnings, guidance, contracts, regulation, analyst rating changes) more heavily.
Return an integer score from 1 to 100, a stance consistent with it (bearish below 40, neutral 40-60, bullish above 60), a short rationale, and the ids of the headlines that drove the score (at least one).`;

export class Scorer {
  private client?: Anthropic;
  constructor(readonly model: string = DEFAULT_MODEL) {}

  async score(asset: TokenizedStock, headlines: Headline[]): Promise<Score> {
    const list = headlines
      .map((h, i) => `[${i}] ${h.publishedAt.slice(0, 16).replace("T", " ")}Z${h.source ? ` (${h.source})` : ""}: ${h.title}`)
      .join("\n");
    this.client ??= new Anthropic(); // reads ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN + ANTHROPIC_BASE_URL (0G Router)
    const res = await this.client.messages.parse({
      model: this.model,
      max_tokens: 2000,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Stock: ${asset.underlying} (traded on BSC as tokenized ${asset.symbol} via ${asset.platform}).\nHeadlines, newest first:\n${list}`,
        },
      ],
      output_config: { format: OUTPUT },
    });
    if (res.stop_reason !== "end_turn") throw new Error(`model stopped with ${res.stop_reason}`);
    const out = res.parsed_output;
    if (!out) throw new Error("model returned no parseable output");

    const score = out.score;
    if (!Number.isInteger(score) || score < 1 || score > 100) throw new Error(`model score out of range: ${score}`);
    const cited = [...new Set(out.citedHeadlineIds)].filter((i) => i >= 0 && i < headlines.length).map((i) => headlines[i]!);
    if (!cited.length) throw new Error("model cited no valid headlines");
    return { score, stance: out.stance, rationale: out.rationale.trim(), cited };
  }
}
