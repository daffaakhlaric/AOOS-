# @aos/logger

Pino-based structured logger with request/correlation/trace/tenant ID propagation, per Constitution §17 Logging Standards.

## Contents

- `logger.ts` — `createLogger(options)`, producing a [Pino](https://getpino.io) logger that supports JSON (production), pretty-printed (local dev), or file-destination output, and auto-enriches every log line via `mixin`.
- `context.ts` — `withLogContext` / `getLogContext`, an `AsyncLocalStorage`-backed context so request/correlation/trace/tenant IDs set once at the top of a request never need to be threaded manually through every function call to reach the logger.

## Dependency Graph

```
@aos/types  ──▶  @aos/common
                       │
                       ▼
                 @aos/logger
```

## Architecture Note

Every log line emitted through `createLogger` automatically carries whatever `requestId`/`correlationId`/`traceId`/`tenantId` is active in the current `AsyncLocalStorage` context — this is what makes Constitution RULE-045 ("every log line includes tenant_id, trace_id") structurally true rather than a convention every call site has to remember. This package intentionally does not implement PII redaction (Constitution RULE-046) — that is a Core Runtime middleware concern layered on top of this logger once a Runtime exists, not something baked into the generic logging primitive itself.

## Usage

```ts
import { createLogger, withLogContext } from "@aos/logger";

const logger = createLogger({ serviceName: "aos-core-runtime", format: "pretty" });

withLogContext({ traceId: "abc-123", tenantId: "tenant-1" }, () => {
  logger.info("Lead scored"); // automatically carries traceId + tenantId
});
```

## Scripts

`pnpm build` · `pnpm lint` · `pnpm test` · `pnpm typecheck`
