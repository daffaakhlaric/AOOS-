import "reflect-metadata";

import { loadEnvFiles } from "@aos/config";
import { createLogger } from "@aos/logger";
import { initTracing } from "@aos/telemetry";

import { parseAaosApiConfig } from "./config/aaos-api.config.js";
import { createApp } from "./create-app.js";

const bootstrapLogger = createLogger({ serviceName: "aaos-api" });

/**
 * Process-boundary bootstrap. This is one of the few places in the whole AAOS stack where
 * crashing the process on startup is the *correct* behavior (per this task's guidance) — every
 * other layer of this app (and the whole of `@aos/meta-ads-connector`) uses `Result<T, E>` and
 * never throws for an expected/recoverable failure. An invalid `AaosApiConfig` at startup is not
 * recoverable — there is no reasonable degraded mode to run this app in without valid Meta API
 * credentials and an API key — so it fails fast with a clear, structured log line and a non-zero
 * exit code, rather than starting a server that would fail every request.
 */
async function bootstrap(): Promise<void> {
  loadEnvFiles();

  const configResult = parseAaosApiConfig();
  if (!configResult.ok) {
    bootstrapLogger.error(
      { error: configResult.error.message },
      "aaos-api: invalid configuration, refusing to start",
    );
    process.exitCode = 1;
    return;
  }
  const config = configResult.value;

  initTracing({ serviceName: "aaos-api" });

  const app = await createApp(config);
  await app.listen(config.PORT, "0.0.0.0");

  bootstrapLogger.info({ port: config.PORT, nodeEnv: config.NODE_ENV }, "aaos-api: listening");
}

bootstrap().catch((error: unknown) => {
  bootstrapLogger.error(
    { error: error instanceof Error ? error.message : String(error) },
    "aaos-api: fatal bootstrap error",
  );
  process.exitCode = 1;
});
