import type { getTracer } from "@aos/telemetry";

/** Local alias avoiding a direct `@opentelemetry/api` dependency — `@aos/telemetry` is the sanctioned entry point. Mirrors `@aos/dss-inventory-connector`'s/`@aos/whatsapp-connector`'s `Tracer` alias exactly. */
export type Tracer = ReturnType<typeof getTracer>;
