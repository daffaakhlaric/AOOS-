import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import type { AaosApiConfig } from "../../src/config/aaos-api.config.js";
import { createApp } from "../../src/create-app.js";
import { buildTestConfig } from "../../src/test-support/fixtures.js";

/**
 * Spins up the REAL `AppModule` (via `createApp`, the same composition entry point `main.ts`
 * uses) against a Fastify adapter, for `supertest`-based e2e HTTP tests. Never calls
 * `app.listen()` — `supertest(app.getHttpServer())` binds an ephemeral port itself.
 */
export async function bootstrapTestApp(
  overrides: Partial<AaosApiConfig> = {},
): Promise<NestFastifyApplication> {
  const config = buildTestConfig(overrides);
  return createApp(config);
}
