import type { DailyLimiter } from "./limiter.js";
import type { LlmProvider } from "./llm.js";

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
  /** Receives one line per failure. Defaults to console.error. Tests inject a spy. */
  logError?: (message: string) => void;
}

const MAX_QUERY_CHARS = 500;
// Telegram rejects message text longer than 4096 characters; keep a safety margin.
const MAX_ANSWER_CHARS = 4000;
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_LOGGED_CHARS = 200;

/**
 * Turns a provider error into a short log line. Only the error name and message are used:
 * never the prompt, the user's text, or the API key. Provider errors are built without
 * request or response bodies (see GroqProvider).
 */
function describeError(err: unknown, timeoutMs: number): string {
  if (err instanceof Error && err.name === "TimeoutError") {
    return `AI request timed out after ${timeoutMs} ms`;
  }
  if (err instanceof Error && err.name === "AbortError") {
    return "AI request was aborted";
  }
  if (err instanceof Error) {
    // Provider messages are written by us (no bodies, no keys), so the message alone is enough.
    return err.message.slice(0, MAX_LOGGED_CHARS);
  }
  return "unknown error";
}

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
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const log = deps.logError ?? ((message: string) => console.error(message));
  try {
    const signal = AbortSignal.timeout(timeoutMs);
    const answer = (await deps.provider.generate(input, signal)).trim();
    if (answer.length === 0) {
      log("AI returned an empty answer");
      return [result(q.id, "No answer", "The AI returned an empty answer. Please try again.")];
    }
    return [result(q.id, "AI answer", answer.slice(0, MAX_ANSWER_CHARS))];
  } catch (err) {
    log(`inline query failed: ${describeError(err, timeoutMs)}`);
    return [
      result(
        q.id,
        "Temporarily unavailable",
        "The AI service is unavailable right now. Please try again later.",
      ),
    ];
  }
}
