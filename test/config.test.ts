import assert from "node:assert/strict";
import { test } from "node:test";
import { loadConfig } from "../src/config.js";

const base = { BOT_TOKEN: "123:abc", GROQ_API_KEY: "gsk_test" };

test("loads required values and applies defaults", () => {
  const cfg = loadConfig(base);
  assert.equal(cfg.botToken, "123:abc");
  assert.equal(cfg.groqApiKey, "gsk_test");
  assert.equal(cfg.dailyLimit, 10);
  assert.equal(cfg.dataFile, "data/usage.json");
  assert.equal(cfg.groqModel, "openai/gpt-oss-20b");
});

test("reports every missing required variable at once", () => {
  assert.throws(
    () => loadConfig({}),
    (err: Error) => {
      assert.match(err.message, /BOT_TOKEN is required/);
      assert.match(err.message, /GROQ_API_KEY is required/);
      return true;
    },
  );
});

test("rejects a non-integer or negative DAILY_LIMIT", () => {
  assert.throws(() => loadConfig({ ...base, DAILY_LIMIT: "abc" }), /DAILY_LIMIT must be/);
  assert.throws(() => loadConfig({ ...base, DAILY_LIMIT: "-1" }), /DAILY_LIMIT must be/);
});

test("accepts overrides for limit, model and data file", () => {
  const cfg = loadConfig({ ...base, DAILY_LIMIT: "3", GROQ_MODEL: "x", DATA_FILE: "tmp/u.json" });
  assert.equal(cfg.dailyLimit, 3);
  assert.equal(cfg.groqModel, "x");
  assert.equal(cfg.dataFile, "tmp/u.json");
});
