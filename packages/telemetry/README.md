# @aos/telemetry

OpenTelemetry tracer/metrics bootstrap plus a generic health-check registry for AOS.

## Contents

- `tracer.ts` — `initTracing`, registering a `NodeTracerProvider` globally (no exporter attached at this phase — see Architecture Note); `getTracer`.
- `metrics.ts` — `initMetrics`, registering a `MeterProvider` globally; `getMeter`.
- `health.ts` — `HealthCheckRegistry`, a register-once, run-many collection of named readiness checks aggregated into a single `HealthReport`.

## Dependency Graph

```
@aos/types  ──▶  @aos/common  ──▶  @aos/logger
                                        │
                                        ▼
                                 @aos/telemetry
```

## Architecture Note

This package only wires up the OpenTelemetry **provider/registration mechanics** — it deliberately does not attach any exporter (OTLP, Prometheus, etc.), because _where_ traces/metrics are shipped is an operational decision belonging to each deployment phase (see `docs/004A-COST-SCALING-STRATEGY.md` §2's Phase 1 Grafana LGTM stack), not something this Foundation package should hardcode. A future Runtime package attaches the actual exporter/span-processor/metric-reader on top of the provider this package creates. `HealthCheckRegistry` is deliberately transport-agnostic too — it produces a `HealthReport` value; exposing that over HTTP (e.g. a `/health` endpoint) is a future app's job.

## Usage

```ts
import { getTracer, HealthCheckRegistry, initMetrics, initTracing } from "@aos/telemetry";

initTracing({ serviceName: "aos-core-runtime" });
initMetrics({ serviceName: "aos-core-runtime" });

const tracer = getTracer("agent-runtime");
const health = new HealthCheckRegistry();
health.register("postgres", async () => true);
```

## Scripts

`pnpm build` · `pnpm lint` · `pnpm test` · `pnpm typecheck`
