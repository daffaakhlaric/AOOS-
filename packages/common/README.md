# @aos/common

`Result<T, E>` / `Option<T>` / `Either<L, R>`, base interfaces (`Identifiable`, `Timestamped`, `TenantScoped`, `Versioned`, `Traceable`), generic helpers, constants, and cross-cutting enums (`ErrorCode`, `Environment`, `LogLevel`) shared across AOS.

## Contents

- `result.ts` — explicit success/failure return type for expected/recoverable failures (Constitution §16).
- `option.ts` — explicit presence/absence type, preferred over scattering `null`/`undefined` through business logic.
- `either.ts` — neutral two-branch disjunction, distinct from `Result`'s success/failure semantics.
- `base-interfaces.ts` — the structural interfaces every future domain Entity/Aggregate composes (`Identifiable`, `Timestamped`, `TenantScoped`, `Versioned`, `Traceable`), mirroring the common envelope fields across every Contract in `docs/003.5-CONTRACT-FIRST-DESIGN.md`.
- `enums.ts` — `ErrorCode` (generic, cross-cutting only — domain-specific codes belong to future domain packages), `Environment`, `LogLevel`.
- `constants.ts` — small, genuinely cross-cutting constants (header names, default timeout/retry ceilings).
- `helpers.ts` — `noop`, `identity`, `isDefined`, `assertNever` (exhaustiveness checking), `clamp`.

## Dependency Graph

```
@aos/types
    │
    ▼
@aos/common
```

## Architecture Note

`@aos/common` is the first package in the dependency graph allowed to express _behavior_ (functions), not just types — but that behavior is still strictly generic: nothing in this package knows what a "Lead" or a "Campaign" is. Per Constitution §2.1 (Single Responsibility) and §3.11 (Hexagonal Architecture), this package is the innermost behavioral layer; every future domain package depends on it, never the reverse.

## Usage

```ts
import { err, isOk, ok, type Result } from "@aos/common";

function parsePositive(input: number): Result<number, string> {
  return input > 0 ? ok(input) : err("must be positive");
}
```

## Scripts

`pnpm build` · `pnpm lint` · `pnpm test` · `pnpm typecheck`
