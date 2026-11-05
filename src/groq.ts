import type { LlmProvider } from "./llm.js";

export interface GroqOptions {
  apiKey: string;
  model: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/** Groq through its OpenAI-compatible chat completions endpoint. Uses plain fetch, no SDK. */
export class GroqProvider implements LlmProvider {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: GroqOptions) {
    this.baseUrl = opts.baseUrl ?? "https://api.groq.com/openai/v1";
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async generate(prompt: string, signal?: AbortSignal): Promise<string> {
    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.opts.model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 400,
      }),
      signal,
    });
    if (res.status === 404) {
      // 404 on this endpoint almost always means the model id is retired or misspelled.
      // The model id is config, not a secret, so it is safe to show.
      throw new Error(`Groq returned 404: model '${this.opts.model}' not found, set GROQ_MODEL in .env`);
    }
    if (!res.ok) {
      // Do not include the response body: it may echo request data.
      throw new Error(`Groq request failed with status ${res.status}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("Groq response has no message content");
    return content;
  }
}
