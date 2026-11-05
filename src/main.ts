import { createBot } from "./bot.js";
import { loadConfig } from "./config.js";
import { GroqProvider } from "./groq.js";
import { DailyLimiter } from "./limiter.js";
import { JsonUsageStore } from "./usage-store.js";

const config = loadConfig();

const provider = new GroqProvider({ apiKey: config.groqApiKey, model: config.groqModel });
const limiter = new DailyLimiter(config.dailyLimit, () => new Date(), new JsonUsageStore(config.dataFile));

const bot = createBot(config.botToken, { provider, limiter, dailyLimit: config.dailyLimit });

process.once("SIGINT", () => void bot.stop());
process.once("SIGTERM", () => void bot.stop());

// Long polling: fine for a small bot run locally. No webhook, no hosting.
await bot.start({
  onStart: (info) => console.log(`Polling as @${info.username}. Press Ctrl+C to stop.`),
});
