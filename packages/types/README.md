# @aos/types

Shared, **dependency-free** TypeScript utility types for AOS. No runtime code, no business logic — purely structural type helpers consumed by every other package.

## Contents

- `utility-types.ts` — `DeepPartial`, `DeepReadonly`, `Nullable`, `Optional`, `Maybe`, `ValueOf`, `NonEmptyArray`, `UnwrapPromise`, `AtLeastOne`, `Constructor`.
- `branded.ts` — `Brand<T, TBrand>` nominal-typing helper, plus `Uuid<TBrand>` and `IsoDateTime` — used for compile-time-safe identifiers (e.g. a future `Uuid<"TenantId">` cannot be silently assigned where a `Uuid<"LeadId">` is expected).
- `json.ts` — `JsonPrimitive`, `JsonValue`, `JsonObject` — the shape every Contract payload (per `docs/003.5-CONTRACT-FIRST-DESIGN.md`) must conform to.

## Dependency Graph

```
@aos/types
  (no internal dependencies — this is the root of the package dependency graph)
```

## Architecture Note

This package exists specifically so that every other Foundation package (and, later, every Runtime package) shares one definition of "what a branded ID looks like" and "what counts as JSON," rather than each package inventing its own. Per Constitution §2 (no unjustified duplication) and §3.11 (Hexagonal Architecture — types are the innermost, most stable layer), `@aos/types` has zero runtime dependencies and must never import from any other `@aos/*` package — it is the leaf of the dependency graph by design (see `docs/005.1-CORE-RUNTIME-FOUNDATION-REPORT.md` for the full package graph).

## Usage

```ts
import type { DeepPartial, JsonObject, Uuid } from "@aos/types";
```

## Scripts

`pnpm build` · `pnpm lint` · `pnpm test` · `pnpm typecheck`
