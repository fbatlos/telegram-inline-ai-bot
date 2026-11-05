import assert from "node:assert/strict";
import { test } from "node:test";
import { createBot } from "../src/bot.js";
import { DailyLimiter } from "../src/limiter.js";
import { MockProvider } from "../src/llm.js";

const botInfo = {
  id: 999,
  is_bot: true as const,
  first_name: "Test",
  username: "test_ai_bot",
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: true,
  can_connect_to_business: false,
  has_main_web_app: false,
  has_topics_enabled: false,
  allows_users_to_create_topics: false,
  can_manage_bots: false,
  supports_join_request_queries: false,
};

/** Creates a bot whose Bot API calls are recorded instead of sent over the network. */
function setup(limit = 10) {
  const calls: { method: string; payload: Record<string, unknown> }[] = [];
  const bot = createBot("000:fake", {
    provider: new MockProvider((p) => `answer:${p}`),
    limiter: new DailyLimiter(limit),
    dailyLimit: limit,
    botInfo,
  });
  bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> });
    return { ok: true, result: true } as never;
  });
  return { bot, calls };
}

const user = { id: 7, is_bot: false, first_name: "Tester" };

test("/start replies with usage help including the bot username and limit", async () => {
  const { bot, calls } = setup(4);
  await bot.handleUpdate({
    update_id: 1,
    message: {
      message_id: 1,
      date: 0,
      chat: { id: 7, type: "private", first_name: "Tester" },
      from: user,
      text: "/start",
      entities: [{ type: "bot_command", offset: 0, length: 6 }],
    },
  });
  const reply = calls.find((c) => c.method === "sendMessage");
  assert.ok(reply, "expected a sendMessage call");
  assert.match(String(reply.payload.text), /@test_ai_bot/);
  assert.match(String(reply.payload.text), /4 answers per day/);
});

test("inline query is answered with the provider result and cache_time 0", async () => {
  const { bot, calls } = setup();
  await bot.handleUpdate({
    update_id: 2,
    inline_query: { id: "iq-1", from: user, query: "what is 2+2", offset: "" },
  });
  const answer = calls.find((c) => c.method === "answerInlineQuery");
  assert.ok(answer, "expected an answerInlineQuery call");
  assert.equal(answer.payload.inline_query_id, "iq-1");
  assert.equal(answer.payload.cache_time, 0);
  const results = answer.payload.results as { input_message_content: { message_text: string } }[];
  assert.equal(results.length, 1);
  assert.equal(results[0].input_message_content.message_text, "answer:what is 2+2");
});

test("empty inline query is answered with no results", async () => {
  const { bot, calls } = setup();
  await bot.handleUpdate({ update_id: 3, inline_query: { id: "iq-2", from: user, query: "  ", offset: "" } });
  const answer = calls.find((c) => c.method === "answerInlineQuery");
  assert.deepEqual(answer?.payload.results, []);
});
