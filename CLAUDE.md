# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Telegram bot (TypeScript) that manages the Hacker Embassy hackerspace: attendance/status tracking, donations and
funds, 3D printer status, door lock/camera access, climate data, wiki, birthdays, and more. It ships as two separate
runtime processes that share most of the codebase:

- **Bot** (`src/bot.ts`) — the Telegram bot itself plus a small public HTTP API (`src/api/bot`) for the space
  website, Home Assistant, and SpaceApi.
- **Embassy API service** (`src/embassy.ts`) — runs on internal hackerspace hardware (two load-balanced devices) and
  exposes `src/api/embassy` endpoints that let the bot talk to internal systems (3D printers, door lock, cameras,
  climate sensors, MQTT devices).

## Commands

```bash
npm run dev              # bot only, tsx watch mode
npm run dev-service      # embassy API service only, tsx watch mode
npm run dev-both         # both at once (run-p)

npm run build            # tsc --skipLibCheck && tsc-alias -> dist/
npm run start            # run built bot from dist/
npm run start-service    # run built embassy service from dist/

npm run test             # jest
npm run test:ci          # jest with coverage
npx jest tests/bot/status.spec.ts        # single test file
npx jest -t "should change the /status"  # single test by name

npm run lint              # eslint '**/*.{ts,js}'
npm run lint-fix
npm run typecheck         # tsc --noEmit --skipLibCheck
npm run pretty            # prettier --write

npm run init               # scripts/initDev.ts — first-time local setup (needs ssh-keygen on PATH)
npm run migrations         # drizzle-kit generate, after editing src/data/schema.ts
```

Node version is pinned via `.nvmrc` (v26.2.0); README states 22+ works too. Husky + lint-staged run
prettier/eslint on staged files at commit time.

## Architecture

### Decorator-based command routing

Bot commands are static methods on controller classes in `src/bot/controllers/*.ts`, registered with decorators
from `src/bot/core/decorators.ts`:

- `@Route(aliases, paramRegex?, paramMapper?)` — one or more command aliases map to a handler; `paramMapper`
  extracts typed args from the regex match.
- `@UserRoles([...])` — restricts a route to roles (`Admins`, `Accountants`, `Members`, `TrustedMembers`, or a raw
  `UserRole[]`).
- `@AllowedChats([...])` — restricts a route to specific chat IDs.
- `@FeatureFlag(flag)` — gates a route behind `config.bot.features.<flag>`.

Every controller implements `BotController` and is registered once in `src/bot/setup.ts::addControllers`.
`src/bot/instance.ts` builds the `HackerEmbassyBot` singleton and calls `addControllers`, `addSpecialRoutes`,
`addEventHandlers`, `setAutomaticFeatures` (cron), and `setMenu` before starting polling.

Handler signature convention: `static async fooHandler(bot: HackerEmbassyBot, msg: Message, ...params)`.

### HackerEmbassyBot core

`src/bot/core/classes/HackerEmbassyBot.ts` wraps `node-telegram-bot-api` with: route dispatch honoring the
decorators above, per-chat/per-user context (`BotMessageContext`, accessed via `bot.context(msg)`), Markdown
(GFM → Telegram MarkdownV2) conversion, streaming message edits for AI responses, message history for edit/delete,
rate limiting (`RateLimit.ts`), and localized replies via `t()` (`src/bot/core/localization.ts`, i18next-backed,
YAML files in `resources/locales`).

### Data layer

SQLite via `better-sqlite3` + Drizzle ORM. `src/data/db.ts` is the client singleton, `src/data/schema.ts` defines
tables, `src/data/migrations/` holds generated SQL migrations (`npm run migrations` after schema changes).
Repositories in `src/data/repositories/*.ts` extend `BaseRepository` (`src/data/repositories/base.ts`), which
injects the drizzle client and a logger — repositories are the only layer that should import `@data/db` directly.
Domain logic sits one layer up in `src/services/domain/*.ts` (e.g. `space.ts`, `user.ts`), which controllers call
instead of repositories directly where domain rules apply.

### Services

`src/services/` is grouped by purpose: `common/` (logger, broadcast event bus, telemetry), `domain/` (space/user/
subscription business logic), `embassy/` (door, 3D printers, Home Assistant, MQTT), `external/` (GitHub, Google
Calendar, wiki/Outline), `funds/` (currency conversion, donations, CSV/report export), `neural/` (OpenAI, local
Ollama/open-webui, Stable Diffusion). `src/services/common/broadcast.ts` is an event emitter
(`BroadcastEvents.SpaceOpened/SpaceClosed/SpaceUnlocked`, etc.) used to decouple state changes (e.g. door/status
changes from embassy hardware) from bot notification handlers wired up in `src/bot/setup.ts::addEventHandlers`.

### Bot HTTP API

`src/api/bot/index.ts` is the Express app started by `StartSpaceApi()` (called alongside `StartTelegramBot()` in
`src/bot.ts`). It mounts `/text` (`routers/text.ts`, plain-text renderings of bot commands like `/status`/`/funds`
for the space website) and `/api` (`routers/api.ts`, which itself mounts `/api/wiki` and `/api/embassy`
sub-routers, plus a `/api/space` endpoint implementing the [SpaceAPI](https://spaceapi.io) standard from
`config/spaceapi.json` / `spaceapi.local.json` via `templates.ts`). Swagger UI is served at `/swagger` from the
checked-in `swagger-schema.json` (regenerate with `npm run swagger`). Its `/api/embassy` sub-router is just a thin
proxy (`routers/embassy.ts`) that calls out to `@services/embassy/embassy.ts` for a couple of LED-matrix/TTS
actions — it is not the embassy service's own API described below, despite the shared name.

### Embassy HTTP API

`src/api/embassy/index.ts` is a separate Express app started by `StartEmbassyApi()` in `src/embassy.ts`, run on
internal hackerspace hardware (not reachable from the public bot host). It mounts one router per subsystem —
`/space` (unlock/alarm), `/speaker`, `/neural` (local Stable Diffusion/LLM), `/devices`, `/printers`, `/climate`,
`/cameras`, `/screen` (`src/api/embassy/routers/*.ts`) — which call into `src/services/embassy/*` and
`src/services/neural/*` to talk to the actual hardware (MQTT, Home Assistant, printers, cameras).

### Config

`config` package with layered JSON: `config/default.json` is checked in and defines full schema; create
`config/local.json` to override for local dev (see `config/schema.d.ts` for types, imported everywhere as
`import { BotConfig } from "@config"`). `config/test.json` is used under Jest. Secrets/tokens are env vars only
(see `.env.example`), loaded via `dotenv/config` in `src/bot.ts` / `src/embassy.ts`.

### Path aliases

Both `tsconfig.json` and `jest.config.ts` define matching path aliases — keep them in sync if you add one:
`@utils/*`, `@services/*`, `@data/*`, `@constants/*`, `@config`, `@hackembot/*` → `src/bot/*`,
`@hackemapi/*` → `src/api/*`, `@resources/*`.

### Tests

Jest + ts-jest, tests live in `tests/bot/*.spec.ts` and `tests/utils/*.spec.ts`. `tests/jestSetup.ts` mocks the
Telegram API over fetch, mocks `@data/db` to an in-memory seeded DB (`src/data/seed.ts`), mocks currency/network/
calendar/logger. `tests/mocks/bot.ts` provides `createMockBot()`/`createMockMessage()` for driving controller
handlers through `processUpdate` and asserting on `popResults()` (translation keys, since locales aren't loaded in
tests — assertions compare against i18n key strings, not rendered text).

## Notes

- Two Node entry points read the same `config.bot` — don't assume `src/bot.ts` is the only process reading a given
  config/service module.
- Don't confuse the two HTTP APIs: `src/api/bot` (public, started by `src/bot.ts`, external-facing for the space
  website/HASS/SpaceApi) and `src/api/embassy` (internal, started by `src/embassy.ts`, runs on hackerspace hardware
  for talking to printers/door/cameras/sensors). They're separate Express apps on separate hosts/ports — a fix in
  one router tree almost never belongs in the other.
- `gateway.hackem.cc` routes through Cloudflare (443) → Caddy origin (:9000) → Express (:3000); port differences
  across those layers are intentional, not a bug.
- Prettier: 4-space tabs, 130 print width, `arrowParens: "avoid"`. ESLint enforces `import/order`.
