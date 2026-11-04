# telegram-inline-ai-bot

Telegram bot that answers AI requests through **inline mode**: type `@your_bot_name <prompt>` in any chat, pick a result, and it is sent to that chat. Free tier with a daily limit; paid tier for higher limits.

- Origin: idea approved from IA Factory scout (`02-DOCS/wiki/ideas/ideas.md`, slug `telegram-inline-ai-bot`, score 18/25).
- Status: MVP in progress.

## Scope

### In scope (MVP)
- Inline query handler: any text query returns one AI-generated answer as an inline result.
- Pluggable LLM provider behind a single interface (`generate(prompt) -> text`).
- Per-user daily request limit (free tier), stored in a local JSON/SQLite file.
- Basic error handling: provider timeouts and rate limits return a friendly message.
- `/start` and `/help` commands in private chat explaining inline usage.
- Unit tests for the handler and limiter with a mock provider.

### Out of scope (MVP)
- Payments and subscriptions (needs a decision: Telegram Stars vs. external).
- Group/admin features, analytics dashboard, multi-language UI.
- Conversation memory between queries (inline mode is stateless by design).
- Any deployment, public launch, or account creation.

## Stack (small technical choices, made by me)
- Runtime: Node.js 20+ (tested on 26.x locally), TypeScript.
- Telegram framework: `grammy` (typed, supports inline queries).
- Tests: `node:test` with `tsx` to run TypeScript directly. No extra test framework.
- Storage: local JSON file for the MVP (`data/usage.json`, git-ignored). Swap to SQLite later if needed.
- LLM provider: **not chosen yet** (see open decisions). The MVP ships with a mock provider so everything runs without an API key.

## Milestones
1. **M0 - Repo and plan.** Repo created, README with scope, first commit. (done)
2. **M1 - Core logic with mock provider.** Inline handler, limiter, provider interface, tests passing offline.
3. **M2 - Telegram wiring.** Bot runs in long polling against a real token supplied via env var. Verified by a manual test in Telegram.
4. **M3 - Real provider.** Plug the chosen LLM API. Verified by one live call logged in the README.
5. **M4 - Packaging for launch.** Config docs, Dockerfile or hosting notes, legal/terms text. Requires explicit approval before any deploy.

## Open decisions (need owner approval)
- [ ] Bot name and brand (affects BotFather setup and the public handle).
- [ ] LLM provider and model (cost per request decides the free-tier limit).
- [ ] Hosting target (local-only, VPS, Railway/Fly, etc.).
- [ ] Monetization: Telegram Stars vs. external payment provider.

## Task checklist

Check a box only with observed proof (test output, run log, or screenshot path).

### M0 - Repo and plan
- [x] `git init` on branch `main` in `Productos/telegram-inline-ai-bot/`
- [x] README with pitch, scope, stack, milestones and checklist
- [x] First commit in English

### M1 - Core logic (mock provider)
- [x] Project scaffold: `package.json`, `tsconfig.json`, `.gitignore` (`npm run typecheck` exit 0)
- [x] `LlmProvider` interface and `MockProvider` (`src/llm.ts`)
- [x] Inline query handler returns one result per query (unit test: `test/handler.test.ts`)
- [x] Empty or whitespace query returns no result (unit test)
- [x] Daily limiter per user id, resets by UTC date (unit test)
- [x] Provider error or timeout maps to a friendly result (unit test)
- [x] `npm test` passes offline (8/8 tests)

Implementation notes (M1):
- Tests run with `tsx` because Node does not map `.js` imports to `.ts` files on its own.
- The limiter is in memory for now. Persistence to `data/usage.json` is still pending and will be added in M2.

### M2 - Telegram wiring
- [ ] Bot starts in polling mode with token from `BOT_TOKEN` env var
- [ ] `/start` and `/help` reply in private chat (manual check, logged)
- [ ] Inline query works end to end in Telegram (manual check, logged)

### M3 - Real provider
- [ ] Provider chosen by owner (open decision)
- [ ] Adapter implemented and covered by a test with a stubbed HTTP call
- [ ] One live call logged in this README

### M4 - Launch prep
- [ ] Hosting chosen by owner (open decision)
- [ ] Terms and privacy text drafted for owner review
- [ ] Deploy only after explicit approval
