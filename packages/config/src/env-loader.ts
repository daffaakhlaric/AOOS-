import { existsSync } from "node:fs";
import { resolve } from "node:path";

import dotenv from "dotenv";

export interface LoadEnvFilesOptions {
  /** Directory to resolve .env files from — defaults to process.cwd(). */
  readonly cwd?: string;
  /** Explicit environment name override — defaults to process.env.NODE_ENV. */
  readonly environment?: string;
}

/**
 * Loads .env files in AOS's standard multi-environment precedence order (highest precedence first,
 * values already present in process.env are never overwritten by a later file):
 *   1. .env.<environment>.local
 *   2. .env.local
 *   3. .env.<environment>
 *   4. .env
 */
export function loadEnvFiles(options: LoadEnvFilesOptions = {}): void {
  const cwd = options.cwd ?? process.cwd();
  const environment = options.environment ?? process.env.NODE_ENV ?? "development";

  const candidates = [`.env.${environment}.local`, ".env.local", `.env.${environment}`, ".env"];

  for (const filename of candidates) {
    const path = resolve(cwd, filename);
    if (existsSync(path)) {
      dotenv.config({ path, override: false });
    }
  }
}
