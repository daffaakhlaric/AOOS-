import { describe, expect, it } from "vitest";

import { MigrationHookRegistry } from "../../src/version/migration-hook-registry.js";

interface TestManifest {
  readonly id: string;
  readonly version: string;
  readonly category: string;
  readonly oldField?: string;
  readonly newField?: string;
}

describe("MigrationHookRegistry", () => {
  it("applies a registered hook for a matching from/to version pair", () => {
    const registry = new MigrationHookRegistry<TestManifest>();
    registry.register({
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      migrate: (manifest) => ({ ...manifest, newField: manifest.oldField, oldField: undefined }),
    });

    const migrated = registry.apply(
      { id: "a", version: "1.0.0", category: "x", oldField: "value" },
      "1.0.0",
      "2.0.0",
    );

    expect(migrated.newField).toBe("value");
  });

  it("passes the manifest through unchanged when no hook matches", () => {
    const registry = new MigrationHookRegistry<TestManifest>();
    const manifest: TestManifest = { id: "a", version: "1.0.0", category: "x" };
    expect(registry.apply(manifest, "1.0.0", "2.0.0")).toBe(manifest);
  });

  it("has() reports whether a hook is registered for a given pair", () => {
    const registry = new MigrationHookRegistry<TestManifest>();
    expect(registry.has("1.0.0", "2.0.0")).toBe(false);
    registry.register({ fromVersion: "1.0.0", toVersion: "2.0.0", migrate: (m) => m });
    expect(registry.has("1.0.0", "2.0.0")).toBe(true);
  });
});
