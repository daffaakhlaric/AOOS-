# AOS — Autonomous Automotive Operating System

Monorepo root. **Foundation phase** (per [`docs/PROMPT-005.1-CORE-RUNTIME-FOUNDATION.md`](./docs/PROMPT-005.1-CORE-RUNTIME-FOUNDATION.md)) — no Runtime, Registry, Workflow, Memory, Event Bus, Scheduler, Planner, Reasoner, Reflection, AI Agent, business module, or Dashboard exists yet. This repository currently contains only the shared, technology-agnostic building blocks every future package/app will depend on.

## Governing Documents

All engineering decisions in this repository are bound by, in order:

1. [`docs/001-ENGINEERING-CONSTITUTION.md`](./docs/001-ENGINEERING-CONSTITUTION.md)
2. [`docs/002-ENTERPRISE-ARCHITECTURE.md`](./docs/002-ENTERPRISE-ARCHITECTURE.md)
3. [`docs/003-DOMAIN-DRIVEN-DESIGN.md`](./docs/003-DOMAIN-DRIVEN-DESIGN.md)
4. [`docs/003.5-CONTRACT-FIRST-DESIGN.md`](./docs/003.5-CONTRACT-FIRST-DESIGN.md)
5. [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](./docs/004-TECHNOLOGY-SELECTION-RECORD.md)
6. [`docs/004A-COST-SCALING-STRATEGY.md`](./docs/004A-COST-SCALING-STRATEGY.md)

If a change here would conflict with any of the above, the conflict must be surfaced and resolved (or escalated to a new ADR) before the change is made — never silently.

## Repository Layout

```
apps/           Reserved for future runtime/dashboard applications (empty in Foundation phase)
packages/       Foundation packages — shared types, errors, utils, config, logger, telemetry, SDK interfaces, testing helpers
configs/        Shared tool configuration (TypeScript, ESLint, Vitest presets) consumed by packages/ and apps/
docker/         Local development infrastructure (docker-compose.yml + service notes)
scripts/        Repo-level automation scripts (setup, clean, build, lint, format, test, typecheck, dev)
docs/           Engineering Constitution, Architecture, DDD, Contract, TSR, and Cost Scaling documents
tests/          Repository-level end-to-end test scaffolding (reserved — no apps exist to test yet)
.github/        Issue/PR templates, CODEOWNERS, Dependabot, CI workflow
```

## Tech Stack (Foundation phase)

TypeScript, Node 22 LTS, pnpm, Turborepo, ESLint, Prettier, Husky + lint-staged, Vitest — all decisions per [`docs/004-TECHNOLOGY-SELECTION-RECORD.md`](./docs/004-TECHNOLOGY-SELECTION-RECORD.md). NestJS, Drizzle ORM, and Playwright are reserved (configured for, not yet used) pending the first real app in Engineering Task 005.2.

## Getting Started

```bash
pnpm install        # install all workspace dependencies
pnpm build           # build every package (Turborepo, dependency-ordered)
pnpm lint             # lint every package
pnpm test             # run unit tests across every package
pnpm typecheck        # type-check every package without emitting
docker compose -f docker/docker-compose.yml config   # validate local infra compose file
```

See [`scripts/`](./scripts) for the underlying automation, and each package's own `README.md` under [`packages/`](./packages) for its purpose, API surface, and architecture notes.

## Packages

| Package                                  | Purpose                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [`@aos/types`](./packages/types)         | Shared, dependency-free TypeScript utility types                                                                          |
| [`@aos/common`](./packages/common)       | `Result`/`Option`/`Either`, base interfaces, generic helpers, constants, enums, error codes                               |
| [`@aos/errors`](./packages/errors)       | Base error class hierarchy built on `@aos/common`'s error codes                                                           |
| [`@aos/utils`](./packages/utils)         | Generic, business-logic-free helper functions                                                                             |
| [`@aos/config`](./packages/config)       | Typed, schema-validated environment/config loader with multi-environment support                                          |
| [`@aos/logger`](./packages/logger)       | Pino-based structured logger with request/correlation/trace ID propagation                                                |
| [`@aos/telemetry`](./packages/telemetry) | OpenTelemetry tracer/metrics/health-check bootstrap                                                                       |
| [`@aos/sdk`](./packages/sdk)             | Type-only interfaces mirroring the Contract Specification (`docs/003.5-CONTRACT-FIRST-DESIGN.md`) — **no implementation** |
| [`@aos/testing`](./packages/testing)     | Shared test doubles/fixtures used by every other package's test suite                                                     |

## Known Limitations (Foundation Phase)

See the closing report in [`docs/005.1-CORE-RUNTIME-FOUNDATION-REPORT.md`](./docs/005.1-CORE-RUNTIME-FOUNDATION-REPORT.md) for the full list of what this phase deliberately does not build yet.
