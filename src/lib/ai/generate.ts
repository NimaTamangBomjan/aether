import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  buildUserMessage,
  checkIdeas,
  ideasResponseSchema,
  SYSTEM_PROMPT,
  type Idea,
  type IdeaRequest,
} from "@/lib/ai/ideas";

export const AI_MODEL = "claude-haiku-4-5";
/** Five ideas fit comfortably in ~700 tokens; the cap keeps any single request cheap. */
const MAX_OUTPUT_TOKENS = 1200;

export type GenerateResult =
  | { ok: true; ideas: Idea[]; inputTokens: number; outputTokens: number }
  | { ok: false; reason: "not_configured" | "invalid" | "api_error" | "timeout"; inputTokens: number; outputTokens: number };

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Asks Claude for exactly 5 gift ideas. If the answer is malformed or breaks a rule
 * (over budget, on the don't-buy list, contains a link) it asks once more, then gives up.
 * Prompts and answers are never logged.
 */
export async function generateIdeas(req: IdeaRequest): Promise<GenerateResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, reason: "not_configured", inputTokens: 0, outputTokens: 0 };

  const deadlineMs = Number(process.env.AI_TIMEOUT_MS ?? 25_000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: deadlineMs });

  let inputTokens = 0;
  let outputTokens = 0;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const message = await client.messages.create(
        {
          model: AI_MODEL,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildUserMessage(req) }],
          output_config: { format: zodOutputFormat(ideasResponseSchema) },
        },
        { signal: controller.signal },
      );
      inputTokens += message.usage.input_tokens;
      outputTokens += message.usage.output_tokens;
      if (message.stop_reason !== "end_turn") continue;

      const text = message.content.find((block) => block.type === "text")?.text;
      if (!text) continue;
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        continue;
      }
      const parsed = ideasResponseSchema.safeParse(json);
      if (!parsed.success) continue;
      const checked = checkIdeas(parsed.data.ideas, req.profile);
      if (checked.ok) return { ok: true, ideas: checked.ideas, inputTokens, outputTokens };
    }
    return { ok: false, reason: "invalid", inputTokens, outputTokens };
  } catch (err) {
    const timedOut =
      err instanceof Anthropic.APIUserAbortError || err instanceof Anthropic.APIConnectionTimeoutError;
    console.error(`ai_request_failed reason=${timedOut ? "timeout" : "api_error"}`);
    return { ok: false, reason: timedOut ? "timeout" : "api_error", inputTokens, outputTokens };
  } finally {
    clearTimeout(timer);
  }
}
