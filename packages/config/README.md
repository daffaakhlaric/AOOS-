# @aos/config

Typed, schema-validated environment/config loading with multi-environment support for AOS.

## Contents

- `env-loader.ts` — `loadEnvFiles`, loading `.env` files in AOS's standard precedence order (`.env.<environment>.local` → `.env.local` → `.env.<environment>` → `.env`), never overwriting a value already present in `process.env`.
- `base-schema.ts` — `baseConfigSchema` (Zod), the minimal generic config (`NODE_ENV`, `SERVICE_NAME`, `LOG_LEVEL`, `PORT`) every service needs; service-specific schemas extend/merge this.
- `typed-config.ts` — `parseConfig`, validating a raw environment record against any Zod schema and returning a typed `Result` instead of throwing.
- `config-registry.ts` — `ConfigRegistry`, an in-memory, register-once/read-many holder for named, already-validated config sections within a single process — explicitly **not** the Registry Contract from `docs/003.5-CONTRACT-FIRST-DESIGN.md` §13, which is a full future runtime service.

## Dependency Graph

```
@aos/types  ──▶  @aos/common  ──▶  @aos/errors
                                        │
                                        ▼
                                  @aos/config
```

## Architecture Note

Configuration failures are treated as expected, recoverable-at-startup failures (`Result`, not thrown exceptions) per Constitution §16 — a service should be able to log a clear validation error and exit cleanly, not crash with an unhandled Zod exception. This package intentionally does not know about any specific infrastructure dependency's config shape (Postgres connection strings, NATS URLs, etc.) — those schemas belong to the future Runtime packages that actually connect to those systems, each extending `baseConfigSchema`.

## Usage

```ts
import { baseConfigSchema, loadEnvFiles, parseConfig } from "@aos/config";
import { isErr } from "@aos/common";

loadEnvFiles();
const result = parseConfig(baseConfigSchema);
if (isErr(result)) {
  console.error(result.error.toJSON());
  process.exit(1);
}
```

## Scripts

`pnpm build` · `pnpm lint` · `pnpm test` · `pnpm typecheck`
