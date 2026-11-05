import { Bot } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { type HandlerDeps, handleInlineQuery } from "./handler.js";

export interface BotDeps extends HandlerDeps {
  dailyLimit: number;
  /** Tests pass botInfo so grammY does not call getMe over the network. */
  botInfo?: UserFromGetMe;
}

function helpText(username: string, dailyLimit: number): string {
  return [
    "I answer AI questions right inside any chat.",
    `1. In any chat, type @${username} followed by your question.`,
    "2. Wait for the results list and tap the answer to send it.",
    `Free tier: ${dailyLimit} answers per day (UTC).`,
  ].join("\n");
}

/** Builds the grammY bot. Commands are plain text replies; inline queries go to the shared handler. */
export function createBot(token: string, deps: BotDeps): Bot {
  const bot = deps.botInfo ? new Bot(token, { botInfo: deps.botInfo }) : new Bot(token);

  bot.command(["start", "help"], async (ctx) => {
    await ctx.reply(helpText(ctx.me.username, deps.dailyLimit));
  });

  bot.on("inline_query", async (ctx) => {
    const results = await handleInlineQuery(
      { id: ctx.inlineQuery.id, query: ctx.inlineQuery.query, fromId: ctx.from.id },
      deps,
    );
    // cache_time 0: answers depend on the user's quota, so they must not be cached.
    await ctx.answerInlineQuery(results, { cache_time: 0, is_personal: true });
  });

  bot.catch((err) => {
    // Log only the error message; the full update may contain user text.
    console.error("bot error:", err.error instanceof Error ? err.error.message : String(err.error));
  });

  return bot;
}
