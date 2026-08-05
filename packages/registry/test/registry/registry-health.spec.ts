import { describe, expect, it } from "vitest";

import { baseManifestSchema } from "../../src/contracts/base-manifest.js";
import { RegistryKind } from "../../src/contracts/registry-kind.js";
import { RegistryHealth } from "../../src/registry/registry-health.js";
import { Registry } from "../../src/registry/registry.js";

describe("Registry Health", () => {
  it("reports healthy with the current entry count and a cache hit ratio", async () => {
    const registry = new Registry({ kind: RegistryKind.TOOL, schema: baseManifestSchema });
    await registry.register({ id: "a", version: "1.0.0", category: "x" });
    registry.get("a");
    registry.get("a");

    const health = new RegistryHealth(registry);
    const report = health.check();

    expect(report.status).toBe("healthy");
    expect(report.entryCount).toBe(1);
    expect(report.cacheHitRatio).toBeGreaterThan(0);
  });

  it("reports a cacheHitRatio of 1 when no cache lookups have happened yet", () => {
    const registry = new Registry({ kind: RegistryKind.TOOL, schema: baseManifestSchema });
    const health = new RegistryHealth(registry);
    expect(health.check().cacheHitRatio).toBe(1);
  });
});
