export interface Config {
  botToken: string;
  groqApiKey: string;
  groqModel: string;
  dailyLimit: number;
  dataFile: string;
}

// Verified 2026-11-05 on console.groq.com/docs/deprecations: llama-3.1-8b-instant was retired 2026-08-16.
// openai/gpt-oss-20b is listed as production with the lowest price and highest speed on console.groq.com/docs/models.
const DEFAULT_MODEL = "openai/gpt-oss-20b";

/** Reads configuration from environment variables. Throws listing every missing or invalid value. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const problems: string[] = [];

  const botToken = env.BOT_TOKEN?.trim() ?? "";
  const groqApiKey = env.GROQ_API_KEY?.trim() ?? "";
  if (!botToken) problems.push("BOT_TOKEN is required");
  if (!groqApiKey) problems.push("GROQ_API_KEY is required");

  const rawLimit = env.DAILY_LIMIT?.trim() || "10";
  const dailyLimit = Number(rawLimit);
  if (!Number.isInteger(dailyLimit) || dailyLimit < 0) {
    problems.push("DAILY_LIMIT must be a non-negative integer");
  }

  if (problems.length > 0) {
    throw new Error(`Invalid configuration:\n- ${problems.join("\n- ")}`);
  }

  return {
    botToken,
    groqApiKey,
    groqModel: env.GROQ_MODEL?.trim() || DEFAULT_MODEL,
    dailyLimit,
    dataFile: env.DATA_FILE?.trim() || "data/usage.json",
  };
}
