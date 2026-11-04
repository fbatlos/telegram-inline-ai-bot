/** Provider-agnostic LLM interface. The real provider is chosen later (see README open decisions). */
export interface LlmProvider {
  generate(prompt: string, signal?: AbortSignal): Promise<string>;
}

/** Offline provider used for tests and local runs without an API key. */
export class MockProvider implements LlmProvider {
  constructor(private readonly reply: (prompt: string) => string = (p) => `Echo: ${p}`) {}

  async generate(prompt: string, signal?: AbortSignal): Promise<string> {
    if (signal?.aborted) throw new Error("aborted");
    return this.reply(prompt);
  }
}
