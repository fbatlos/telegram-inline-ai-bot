import assert from "node:assert/strict";
import { test } from "node:test";
import { GroqProvider } from "../src/groq.js";

function stubFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

test("sends an OpenAI-compatible chat request to Groq with the key", async () => {
  const { fetchImpl, calls } = stubFetch(200, { choices: [{ message: { content: "hi there" } }] });
  const provider = new GroqProvider({ apiKey: "gsk_test", model: "m1", fetchImpl });

  const out = await provider.generate("hello");

  assert.equal(out, "hi there");
  assert.equal(calls[0].url, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, "Bearer gsk_test");
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.model, "m1");
  assert.deepEqual(body.messages, [{ role: "user", content: "hello" }]);
});

test("non-OK status throws without echoing the response body", async () => {
  const { fetchImpl } = stubFetch(429, { error: "secret echo of prompt" });
  const provider = new GroqProvider({ apiKey: "k", model: "m", fetchImpl });
  await assert.rejects(provider.generate("x"), (err: Error) => {
    assert.equal(err.message, "Groq request failed with status 429");
    assert.ok(!err.message.includes("secret"));
    return true;
  });
});

test("404 names the model and tells the user to set GROQ_MODEL", async () => {
  const { fetchImpl } = stubFetch(404, {
    error: { message: "The model `llama-3.1-8b-instant` does not exist" },
  });
  const provider = new GroqProvider({ apiKey: "gsk_secret", model: "retired-model-x", fetchImpl });
  await assert.rejects(provider.generate("x"), (err: Error) => {
    assert.equal(err.message, "Groq returned 404: model 'retired-model-x' not found, set GROQ_MODEL in .env");
    assert.ok(!err.message.includes("gsk_secret"), "message must not contain the API key");
    return true;
  });
});

test("response without message content throws", async () => {
  const { fetchImpl } = stubFetch(200, { choices: [] });
  const provider = new GroqProvider({ apiKey: "k", model: "m", fetchImpl });
  await assert.rejects(provider.generate("x"), /no message content/);
});
