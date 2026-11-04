import { test } from "node:test";
import assert from "node:assert/strict";
import { handleInlineQuery } from "../src/handler.js";
import { MockProvider, type LlmProvider } from "../src/llm.js";
import { DailyLimiter } from "../src/limiter.js";

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

test("provider error maps to a friendly result and does not throw", async () => {
  const failing: LlmProvider = {
    generate: async () => {
      throw new Error("upstream 500");
    },
  };
  const res = await handleInlineQuery(q("hola"), { provider: failing, limiter: new DailyLimiter(10) });
  assert.equal(res[0].title, "Temporarily unavailable");
});

test("provider timeout maps to a friendly result", async () => {
  const slow: LlmProvider = {
    generate: (_p, signal) =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("aborted")));
      }),
  };
  const res = await handleInlineQuery(q("hola"), {
    provider: slow,
    limiter: new DailyLimiter(10),
    timeoutMs: 20,
  });
  assert.equal(res[0].title, "Temporarily unavailable");
});

test("empty provider answer returns a retry message", async () => {
  const res = await handleInlineQuery(q("hola"), {
    provider: new MockProvider(() => "   "),
    limiter: new DailyLimiter(10),
  });
  assert.equal(res[0].title, "No answer");
});
