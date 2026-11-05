import assert from "node:assert/strict";
import { test } from "node:test";
import { handleInlineQuery } from "../src/handler.js";
import { DailyLimiter } from "../src/limiter.js";
import { type LlmProvider, MockProvider } from "../src/llm.js";

const q = (query: string, fromId = 1) => ({ id: "q1", query, fromId });

test("returns one article result with the provider answer", async () => {
  const res = await handleInlineQuery(q("hola"), {
    provider: new MockProvider((p) => `answer to ${p}`),
    limiter: new DailyLimiter(10),
  });
  assert.equal(res.length, 1);
  assert.equal(res[0].type, "article");
  assert.equal(res[0].input_message_content.message_text, "answer to hola");
});

test("empty or whitespace query returns no results and does not consume quota", async () => {
  const limiter = new DailyLimiter(1);
  const deps = { provider: new MockProvider(), limiter };
  assert.deepEqual(await handleInlineQuery(q("   "), deps), []);
  assert.equal(limiter.tryConsume(1), true, "quota should still be available");
});

test("limiter blocks requests over the daily limit with a friendly result", async () => {
  const deps = { provider: new MockProvider(), limiter: new DailyLimiter(1) };
  await handleInlineQuery(q("first"), deps);
  const res = await handleInlineQuery(q("second"), deps);
  assert.equal(res[0].title, "Daily limit reached");
});

test("limiter resets when the UTC date changes", () => {
  let now = new Date("2026-01-01T23:00:00Z");
  const limiter = new DailyLimiter(1, () => now);
  assert.equal(limiter.tryConsume(7), true);
  assert.equal(limiter.tryConsume(7), false);
  now = new Date("2026-01-02T00:05:00Z");
  assert.equal(limiter.tryConsume(7), true);
});

test("limiter counts users separately", () => {
  const limiter = new DailyLimiter(1);
  assert.equal(limiter.tryConsume(1), true);
  assert.equal(limiter.tryConsume(2), true);
});

test("provider error maps to a friendly result, is logged, and does not throw", async () => {
  const logs: string[] = [];
  const failing: LlmProvider = {
    generate: async () => {
      throw new Error("Groq request failed with status 401");
    },
  };
  const res = await handleInlineQuery(q("hola"), {
    provider: failing,
    limiter: new DailyLimiter(10),
    logError: (m) => logs.push(m),
  });
  assert.equal(res[0].title, "Temporarily unavailable");
  assert.equal(logs.length, 1);
  assert.match(logs[0], /Groq request failed with status 401/);
});

test("failure log never contains the user's prompt or an API key", async () => {
  const logs: string[] = [];
  const secretPrompt = "my-private-question-XYZ";
  const failing: LlmProvider = {
    generate: async () => {
      throw new Error("Groq request failed with status 500");
    },
  };
  await handleInlineQuery(q(secretPrompt), {
    provider: failing,
    limiter: new DailyLimiter(10),
    logError: (m) => logs.push(m),
  });
  assert.equal(logs.length, 1);
  assert.ok(!logs[0].includes(secretPrompt), "log must not contain the user prompt");
  assert.ok(!logs[0].includes("gsk_"), "log must not contain an API key");
});

test("provider timeout maps to a friendly result and logs the timeout distinctly", async () => {
  const logs: string[] = [];
  // Mirrors real fetch: an aborted request rejects with signal.reason (TimeoutError for AbortSignal.timeout).
  const slow: LlmProvider = {
    generate: (_p, signal) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(signal.reason));
      }),
  };
  const res = await handleInlineQuery(q("hola"), {
    provider: slow,
    limiter: new DailyLimiter(10),
    timeoutMs: 20,
    logError: (m) => logs.push(m),
  });
  assert.equal(res[0].title, "Temporarily unavailable");
  assert.equal(logs.length, 1);
  assert.match(logs[0], /timed out after 20 ms/);
});

test("empty provider answer returns a retry message", async () => {
  const res = await handleInlineQuery(q("hola"), {
    provider: new MockProvider(() => "   "),
    limiter: new DailyLimiter(10),
    logError: () => {},
  });
  assert.equal(res[0].title, "No answer");
});
