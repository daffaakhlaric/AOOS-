import type { getTracer } from "@aos/telemetry";

/** Local alias avoiding a direct `@opentelemetry/api` dependency — mirrors every prior AAOS package's identical `Tracer` alias. */
export type Tracer = ReturnType<typeof getTracer>;
