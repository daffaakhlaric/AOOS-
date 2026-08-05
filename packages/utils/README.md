# @aos/utils

Generic, **business-logic-free** helper functions for AOS.

## Contents

- `async.ts` — `sleep`, `retry` (generic retry-with-backoff primitive — not the Tool Contract's own business-level `retry_policy`, but what such a policy would be implemented on top of).
- `array.ts` — `chunk`, `unique`, `groupBy`.
- `object.ts` — `deepClone` (JSON-safe only), `isNil`, `omitNil`, `pick`.

## Dependency Graph

```
@aos/types  ──▶  @aos/common
                       │
                       ▼
                 @aos/utils
```

## Architecture Note

Every function here is intentionally domain-agnostic — nothing in this package may reference "Lead," "Campaign," "Tenant," or any other DDD concept. If a helper starts needing to know about a domain concept, it belongs in a future domain package, not here (Constitution §2.1 Single Responsibility, §2.2 Open/Closed).

## Scripts

`pnpm build` · `pnpm lint` · `pnpm test` · `pnpm typecheck`
