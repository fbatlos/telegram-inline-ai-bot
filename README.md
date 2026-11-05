# telegram-inline-ai-bot

Telegram bot that answers AI requests through **inline mode**: type `@your_bot_name <prompt>` in any chat, pick a result, and it is sent to that chat. Launch is free (daily limit per user). No charging yet.

- Origin: idea approved from IA Factory scout (`02-DOCS/wiki/ideas/ideas.md`, slug `telegram-inline-ai-bot`, score 18/25).
- Status: M0, M1 and M2 code done; M2 Telegram manual checks and M3 live call pending (need owner's bot token and Groq key).

## Scope

### In scope (MVP, launch free)

- Inline query handler: any text query returns one AI answer as an inline result.
- `/start` and `/help` in private chat explaining inline usage.
- Real LLM provider: Groq, behind the `LlmProvider` interface. `MockProvider` for tests.
- Per-user daily limit (default 10 per UTC day), persisted to `data/usage.json`.
- Friendly results on quota exceeded, provider error, timeout or empty answer.

### Out of scope (MVP)

- Payments, subscriptions, Telegram Stars (not decided; no charging now).
- Hosting and deployment (local polling only).
- Group/admin features, analytics, multi-language UI, conversation memory.

## Tool choices (researched 2026-11, decided by me, owner approved direction)

| Need          | Choice                                                                               | Why                                                                                                 | Alternatives considered                                                                   |
| ------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| LLM           | **Groq**, OpenAI-compatible endpoint `https://api.groq.com/openai/v1`, plain `fetch` | Free tier usable without billing; OpenAI-compatible so the provider swaps easily; no SDK dependency | Gemini free tier as fallback (not implemented yet); OpenAI and Anthropic need paid credit |
| Model         | `openai/gpt-oss-20b` (env `GROQ_MODEL`), verified 2026-11-05 on console.groq.com/docs/models and /docs/deprecations | Listed as production; lowest price and highest speed of the production list; `llama-3.1-8b-instant` was retired 2026-08-16 (404) | `llama-3.3-70b-versatile` and `openai/gpt-oss-120b` cost more; `gpt-oss-20b` is not an 8B model |
| Persistence   | JSON file via `node:fs`, atomic write (tmp + rename)                                 | Zero dependencies; counters are tiny                                                                | SQLite via `node:sqlite` is still flagged experimental on Node 22                         |
| Env handling  | `node --env-file-if-exists=.env` (no dotenv)                                         | Built into Node 22.9+; `.env` is git-ignored                                                        | `dotenv` package (unnecessary)                                                            |
| Telegram      | `grammy` 1.x, long polling (`bot.start()`)                                           | Typed; grammY docs describe polling as the simple path for small bots                               | Webhooks need hosting, which is out of scope                                              |
| Tests         | `node:test` + `tsx`                                                                  | No test framework to maintain                                                                       | Vitest/Jest                                                                               |
| Lint + format | Biome 2.x (`npm run lint`, `npm run format`)                                         | One tool, free, MIT                                                                                 | ESLint + Prettier (two configs)                                                           |
| CI            | GitHub Actions (`.github/workflows/ci.yml`): typecheck, lint, test                   | Free for public repos; no deploy step                                                               | None                                                                                      |

Data protection note: the owner prefers Groq for EU personal data. Research did not confirm Groq's DPA, sub-processors, data location or zero-retention terms. Before launch, read Groq's Services Agreement and DPA, and do not send data you cannot justify. The bot only sends the user's inline query text to the API.

Sources used for these choices (last 6 months):

- Groq endpoint and free-tier figures, third-party summaries only: https://fremodel.pages.dev/providers/groq , https://localaimaster.com/blog/groq-api-free-guide . Verify limits in the Groq console.
- Groq privacy and data handling, unverified third-party summaries: https://conductatlas.com/platform/groq/groq-privacy-policy/data-retention-policy/ . Official privacy policy: https://groq.com/privacy-policy (effective date 12 Nov 2025 per the search snippet).
- grammY long polling and `bot.stop()`: https://jsr.io/@grammyjs/grammy/doc/~/Bot . grammY inline-mode page not found in search; the code follows the grammY API as installed (1.46.0).
- Node `--env-file` and `node:sqlite` status: https://flaviocopes.com/courses/sqlite/sqlite-from-node/ (secondary, conflicting). Official Node docs were not retrieved.

## Milestones

1. **M0 - Repo and plan.** (done)
2. **M1 - Core logic with mock provider.** (done, offline tests)
3. **M2 - Telegram wiring.** Code done (polling, commands, inline handler, persistence). Manual checks in Telegram pending.
4. **M3 - Real provider.** Groq adapter done and tested with a stubbed fetch. One live call pending a key from the owner.
5. **M4 - Launch prep.** Hosting, terms text. Only after explicit approval.

## Run it locally

Prerequisites: Node 22.9 or newer (tested on 26.13.0), npm.

```bash
cd Productos/telegram-inline-ai-bot
npm install
cp .env.example .env        # then edit .env: set BOT_TOKEN and GROQ_API_KEY
npm start                   # long polling; Ctrl+C to stop
```

Checks (all offline except `npm start`):

```bash
npm run typecheck
npm run lint
npm test
```

Manual Telegram test (owner, once):

1. In @BotFather: `/newbot`, pick a name and username, copy the token into `.env` as `BOT_TOKEN`.
2. In @BotFather: `/setinline` on your bot, then set the placeholder text (for example "Ask AI").
3. Get a free Groq key at https://console.groq.com and put it in `.env` as `GROQ_API_KEY`.
4. Run `npm start`. You should see `Polling as @<username>`.
5. In Telegram, open a private chat with the bot and send `/start`. Expect the help text.
6. In any chat, type `@<username> what is the capital of France` and wait. Pick the result to send it.
7. Send more than `DAILY_LIMIT` queries in one day; the last result should say the daily limit was reached.

## Known limits (MVP)

- Telegram sends an inline query on each typing pause, so one sentence can use several quota units. Mitigation later: a minimum length or a "send on pick" flow.
- Usage counters live in a local file. Running two instances would split the counts.
- Long polling is for a single local process.

## Task checklist

Check a box only with observed proof (test output, run log, or screenshot path).

### M0 - Repo and plan

- [x] `git init` on branch `main` in `Productos/telegram-inline-ai-bot/`
- [x] README with pitch, scope, stack, milestones and checklist
- [x] First commit in English

### M1 - Core logic (mock provider)

- [x] Project scaffold: `package.json`, `tsconfig.json`, `.gitignore` (`npm run typecheck` exit 0)
- [x] `LlmProvider` interface and `MockProvider` (`src/llm.ts`)
- [x] Inline query handler returns one result per query (`test/handler.test.ts`)
- [x] Empty or whitespace query returns no result
- [x] Daily limiter per user id, resets by UTC date
- [x] Provider error or timeout maps to a friendly result
- [x] `npm test` passes offline (8/8 at M1; 21/21 at M2)

### M2 - Telegram wiring

- [x] Config from env with clear errors on missing `BOT_TOKEN`, `GROQ_API_KEY` or bad `DAILY_LIMIT` (`test/config.test.ts`)
- [x] Limiter counts persist across restart and old days are pruned (`test/usage-store.test.ts`)
- [x] `/start` and `/help` reply text, checked through grammY update handling with a stubbed Bot API (`test/bot.test.ts`). This is not a real Telegram check.
- [x] Inline query is answered with `cache_time 0` and the handler result, checked with a stubbed Bot API (`test/bot.test.ts`)
- [ ] Bot starts in polling with a real `BOT_TOKEN` (owner step, needs token)
- [ ] `/start` and `/help` work in real Telegram (manual check, logged)
- [ ] Inline query works end to end in real Telegram (manual check, logged)

### M3 - Real provider

- [x] Provider chosen: Groq (owner approved direction)
- [x] Adapter covered by tests with a stubbed `fetch` (`test/groq.test.ts`)
- [ ] One live Groq call logged here (needs `GROQ_API_KEY` from owner)

### M4 - Launch prep

- [ ] Hosting chosen by owner (open decision)
- [ ] Terms and privacy text drafted for owner review
- [ ] Deploy only after explicit approval

## Open decisions (owner)

- [ ] Bot name and username (created by the owner in BotFather).
- [ ] Hosting target after local tests (local only for now).
- [ ] Gemini fallback provider: not built; decide if needed.
- [ ] Monetization later: not now (no charging at launch).
