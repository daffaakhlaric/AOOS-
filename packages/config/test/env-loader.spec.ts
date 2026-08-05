import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadEnvFiles } from "../src/env-loader.js";

describe("loadEnvFiles", () => {
  let dir: string;
  const originalValue = process.env.AOS_TEST_ENV_LOADER_VALUE;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "aos-config-test-"));
    delete process.env.AOS_TEST_ENV_LOADER_VALUE;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    if (originalValue === undefined) {
      delete process.env.AOS_TEST_ENV_LOADER_VALUE;
    } else {
      process.env.AOS_TEST_ENV_LOADER_VALUE = originalValue;
    }
  });

  it("loads values from a .env file in the given cwd", () => {
    writeFileSync(join(dir, ".env"), "AOS_TEST_ENV_LOADER_VALUE=from-dotenv\n");
    loadEnvFiles({ cwd: dir, environment: "test" });
    expect(process.env.AOS_TEST_ENV_LOADER_VALUE).toBe("from-dotenv");
  });

  it("prefers .env.<environment>.local over plain .env", () => {
    writeFileSync(join(dir, ".env"), "AOS_TEST_ENV_LOADER_VALUE=base\n");
    writeFileSync(join(dir, ".env.test.local"), "AOS_TEST_ENV_LOADER_VALUE=test-local\n");
    loadEnvFiles({ cwd: dir, environment: "test" });
    expect(process.env.AOS_TEST_ENV_LOADER_VALUE).toBe("test-local");
  });

  it("does nothing when no .env files exist", () => {
    loadEnvFiles({ cwd: dir, environment: "test" });
    expect(process.env.AOS_TEST_ENV_LOADER_VALUE).toBeUndefined();
  });
});
