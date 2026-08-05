# @aos/errors

Base error class hierarchy for AOS, built on `@aos/common`'s `ErrorCode` enum.

## Contents

- `aos-error.ts` — `AosError`, the base class every AOS error extends; carries a stable `code`, a human message, optional `cause`, and optional structured `context` (tenant/trace/correlation IDs).
- `specific-errors.ts` — one concrete subclass per generic `ErrorCode` value: `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `TimeoutError`, `RateLimitedError`, `UnavailableError`, `InternalError`.
- `type-guards.ts` — `isAosError` (narrows `unknown` caught values), `toError` (normalizes any thrown value into a real `Error`, so logging code never has to guard against non-Error throws).

## Dependency Graph

```
@aos/types  ──▶  @aos/common
                       │
                       ▼
                 @aos/errors
```

## Architecture Note

Every future domain-specific error (e.g. a hypothetical `LeadNotFoundError`) is expected to extend one of these base classes rather than `Error` directly, so that any code catching errors platform-wide can rely on `isAosError` and a stable `code` regardless of which package threw it — this is what makes Constitution §16's "errors are values with codes, not ad hoc strings" enforceable in practice, not just in principle.

## Usage

```ts
import { NotFoundError } from "@aos/errors";

throw new NotFoundError("Lead not found", { context: { tenantId, traceId } });
```

## Scripts

`pnpm build` · `pnpm lint` · `pnpm test` · `pnpm typecheck`
