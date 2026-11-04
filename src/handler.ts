import type { LlmProvider } from "./llm.js";
import type { DailyLimiter } from "./limiter.js";

export interface InlineQuery {
  id: string;
  query: string;
  fromId: number;
}

export interface InlineResult {
  type: "article";
  id: string;
  title: string;
  description: string;
  input_message_content: { message_text: string };
}

export interface HandlerDeps {
  provider: LlmProvider;
  limiter: DailyLimiter;
  timeoutMs?: number;
}

const MAX_QUERY_CHARS = 500;

function result(id: string, title: string, text: string): InlineResult {
  return {
    type: "article",
    id,
    title,
    description: text.slice(0, 100),
    input_message_content: { message_text: text },
  };
}

/** Builds the inline results for one query. Never throws: failures become friendly results. */
export async function handleInlineQuery(q: InlineQuery, deps: HandlerDeps): Promise<InlineResult[]> {
  const prompt = q.query.trim();
  if (prompt.length === 0) return [];

  if (!deps.limiter.tryConsume(q.fromId)) {
    return [result(q.id, "Daily limit reached", "You have reached today's free limit. Try again tomorrow.")];
  }

  const input = prompt.slice(0, MAX_QUERY_CHARS);
  try {
    const signal = AbortSignal.timeout(deps.timeoutMs ?? 15_000);
    const answer = (await deps.provider.generate(input, signal)).trim();
    if (answer.length === 0) {
      return [result(q.id, "No answer", "The AI returned an empty answer. Please try again.")];
    }
    return [result(q.id, "AI answer", answer)];
  } catch {
    return [result(q.id, "Temporarily unavailable", "The AI service is unavailable right now. Please try again later.")];
  }
}
