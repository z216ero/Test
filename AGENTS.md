# AGENTS.md

## Project
- Stack: React Native (mobile), ASP.NET Core Minimal API (api), .NET Aspire (local orchestration), PostgreSQL (db via docker-compose).
- Repo layout (expected):
  - apps/api/            -> Minimal API
  - apps/apphost/        -> Aspire AppHost
  - apps/mobile/         -> React Native app
  - infra/compose.yml    -> Postgres (and optional deps)
  - docs/domain.md       -> domain rules (source of truth)

## Domain (MVP scope)
- Roles: Trainer, Client. (No chat, no nutrition, no social feed, no online coaching, no inbody.)
- Core flows: trainer creates slots; client books; cancel/reschedule; trainer marks attendance; payments are manual status.
- Time: store UTC in API/DB; convert to local time in mobile UI.

## Dev environment tips
- Prefer running the whole stack via Aspire:
  - `dotnet run --project apps/apphost`
- DB locally via docker-compose:
  - `docker compose -f infra/compose.yml up -d`
- Mobile:
  - install deps from repo root or `apps/mobile` (use the lockfile you find: npm/yarn/pnpm)
  - Android emulator uses `10.0.2.2` instead of `localhost` for API base URL
  - physical device uses `http://<your-lan-ip>:<port>` (same Wi-Fi) or use a tunnel for HTTPS dev

## Stack and versions
Backend:
- .NET 10 (non-LTS, preview is acceptable)
- ASP.NET Core Minimal API
- EF Core 10
- C# language version: latest / preview enabled

Frontend (mobile):
- React Native (latest stable)
- TypeScript (latest)
- Tamagui (latest stable)
- React Navigation (latest)

Infrastructure:
- PostgreSQL 15+
- Docker and docker-compose (for local infra only)
- .NET Aspire (latest compatible with .NET 10)
            
## Contract-first API usage
- API must expose Swagger/OpenAPI.
- When API endpoints change, update the mobile client usage in the same PR.
- Do not "invent" new endpoints/fields beyond docs/domain.md.

## Testing & checks (run before PR)
- .NET:
  - `dotnet build`
  - `dotnet test`
- Mobile (pick the standard scripts present in package.json):
  - `npm test` / `yarn test`
  - `npm run lint` / `yarn lint`
  - ensure TypeScript passes (often part of lint or a `typecheck` script)

## PR / commit rules
- Branch name: `task-<id>-<short description>` (example: `task-1000-add-login-btn`).
- Keep PRs small and vertical: API + DB migration (if needed) + mobile wiring.
- No broad refactors during feature work unless explicitly requested.
- Never swallow errors silently. Return proper status codes and messages.

## CI/CD intent (high level)
- On push/PR: build + tests for api and mobile (at least compile/typecheck).
- On PR: deploy Preview API for the branch (Swagger available).
- On merge to main: deploy Staging API.

## Gotchas (keep updating with real mistakes)
- If bookings can race, enforce atomic booking on the server (no double-booking).
- Always use UTC in DB and API; never store local times in DB.
- Avoid breaking API contract without updating mobile.

## Business rules
- All business logic and constraints are defined in docs/domain.md
- If there is a conflict between code and docs/domain.md, docs/domain.md wins
- Never invent domain rules not explicitly described there

## UI rules
- Use a component library (do not build UI from scratch)
- Prefer simple, neutral design
- No custom design systems in MVP
- Focus on usability, not visual experiments

## UI stack & style

- Use Tamagui for all UI components and styling in the mobile app.
- Do NOT use React Native StyleSheet directly unless absolutely required.
- Prefer Tamagui primitives (Stack, XStack, YStack, Text, Button, Input).
- Reuse Tamagui tokens (spacing, colors, font sizes) instead of hardcoded values.
- No custom design system in MVP beyond Tamagui configuration.

## UI style rules (mandatory)

- UI style is defined in docs/ui-style.md and is the single source of truth for visual design.
- All screens must follow the principles described in ui-style.md.
- Do NOT invent new visual styles per screen.
- Any UI change that deviates from ui-style.md must be explicitly discussed and agreed upon.
- Reference images may be used as inspiration, but text rules in ui-style.md have priority.


## Documentation and references
- Always use Context7 MCP when library or framework documentation is needed.
- This includes: API usage, setup steps, configuration, best practices, and examples.
- Do NOT rely on prior knowledge or assumptions for third-party libraries.
- If Context7 MCP is unavailable, explicitly state the limitation before proceeding.

## Decision hierarchy
1. docs/domain.md — business rules (highest priority)
2. AGENTS.md — development rules
3. Library documentation via Context7 MCP
4. Codebase conventions

## Language usage
- Prefer modern language features available in the selected versions.
- For C# (.NET 10): use latest syntax and language features when they improve clarity and safety.
- For TypeScript: prefer strict typing and modern TS features.
- Do NOT use new features only for novelty; readability and correctness come first.
