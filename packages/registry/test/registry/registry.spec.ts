import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import type { z } from "zod";

import { baseManifestSchema } from "../../src/contracts/base-manifest.js";
import { EntryStatus } from "../../src/contracts/entry-status.js";
import { RegistryKind } from "../../src/contracts/registry-kind.js";
import {
  DependencyException,
  RegistryException,
  ValidationException,
} from "../../src/errors/index.js";
import { RegistryEventName } from "../../src/events/registry-event-name.js";
import { Registry } from "../../src/registry/registry.js";

const testSchema = baseManifestSchema;
type TestManifest = z.infer<typeof testSchema>;

function makeRegistry() {
  return new Registry<TestManifest>({ kind: RegistryKind.TOOL, schema: testSchema });
}

describe("Registry — register/get/list/count", () => {
  it("register() returns a fully-populated RegistryEntry", async () => {
    const registry = makeRegistry();
    const entry = await registry.register({ id: "kie", version: "1.0.0", category: "media" });

    expect(entry.manifest.id).toBe("kie");
    expect(entry.status).toBe(EntryStatus.ACTIVE);
    expect(entry.registryKind).toBe(RegistryKind.TOOL);
    expect(entry.changelog).toEqual(["1.0.0"]);
  });

  it("register() rejects a manifest failing schema validation", async () => {
    const registry = makeRegistry();
    // @ts-expect-error deliberately invalid for the test
    await expect(
      registry.register({ id: "bad id", version: "1.0.0", category: "x" }),
    ).rejects.toThrow(ValidationException);
  });

  it("register() emits ValidationFailed on failure", async () => {
    const registry = makeRegistry();
    const listener = vi.fn();
    registry.events.on(RegistryEventName.VALIDATION_FAILED, listener);
    // @ts-expect-error deliberately invalid
    await registry
      .register({ id: "bad id", version: "1.0.0", category: "x" })
      .catch(() => undefined);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("register() rejects a manifest that depends on itself", async () => {
    const registry = makeRegistry();
    await expect(
      registry.register({ id: "a", version: "1.0.0", category: "x", dependencies: ["a"] }),
    ).rejects.toThrow(DependencyException);
  });

  it("registering a second, higher version keeps both retrievable via versions()", async () => {
    const registry = makeRegistry();
    await registry.register({ id: "kie", version: "1.0.0", category: "media" });
    await registry.register({ id: "kie", version: "2.0.0", category: "media" });
    expect(registry.versions("kie")).toEqual(["1.0.0", "2.0.0"]);
  });

  it("list()/discover() return the latest version per id", async () => {
    const registry = makeRegistry();
    await registry.register({ id: "kie", version: "1.0.0", category: "media" });
    await registry.register({ id: "kie", version: "2.0.0", category: "media" });
    await registry.register({ id: "postiz", version: "1.0.0", category: "social" });

    expect(registry.list()).toHaveLength(2);
    expect(registry.list().find((e) => e.manifest.id === "kie")?.manifest.version).toBe("2.0.0");
    expect(registry.discover()).toEqual(registry.list());
  });

  it("count reflects the number of distinct registered ids", async () => {
    const registry = makeRegistry();
    await registry.register({ id: "a", version: "1.0.0", category: "x" });
    await registry.register({ id: "b", version: "1.0.0", category: "x" });
    expect(registry.count).toBe(2);
  });

  it("has() reflects registration state", async () => {
    const registry = makeRegistry();
    expect(registry.has("a")).toBe(false);
    await registry.register({ id: "a", version: "1.0.0", category: "x" });
    expect(registry.has("a")).toBe(true);
  });
});

describe("Registry — get() / Cache Test", () => {
  it("get() resolves the latest version and caches it", async () => {
    const registry = makeRegistry();
    await registry.register({ id: "kie", version: "1.0.0", category: "media" });

    const first = registry.get("kie");
    const second = registry.get("kie");

    expect(first?.manifest.version).toBe("1.0.0");
    expect(second).toBe(first); // same object from cache
    expect(registry.metrics.snapshot().cacheHits).toBeGreaterThan(0);
  });

  it("get() with an explicit version reference bypasses the cache", async () => {
    const registry = makeRegistry();
    await registry.register({ id: "kie", version: "1.0.0", category: "media" });
    expect(registry.get("kie", "1.0.0")?.manifest.version).toBe("1.0.0");
  });

  it("registering a new version invalidates the cache for that id", async () => {
    const registry = makeRegistry();
    await registry.register({ id: "kie", version: "1.0.0", category: "media" });
    registry.get("kie"); // populate cache
    await registry.register({ id: "kie", version: "2.0.0", category: "media" });
    expect(registry.get("kie")?.manifest.version).toBe("2.0.0");
  });
});

describe("Registry — update/remove/enable/disable", () => {
  it("update() registers a new version of an existing id", async () => {
    const registry = makeRegistry();
    await registry.register({ id: "kie", version: "1.0.0", category: "media" });
    const updated = await registry.update("kie", {
      id: "kie",
      version: "1.1.0",
      category: "media",
    });
    expect(updated.manifest.version).toBe("1.1.0");
  });

  it("update() rejects a manifest.id mismatch", async () => {
    const registry = makeRegistry();
    await registry.register({ id: "kie", version: "1.0.0", category: "media" });
    await expect(
      registry.update("kie", { id: "other", version: "1.1.0", category: "media" }),
    ).rejects.toThrow(RegistryException);
  });

  it("update() rejects updating an id that was never registered", async () => {
    const registry = makeRegistry();
    await expect(
      registry.update("ghost", { id: "ghost", version: "1.0.0", category: "x" }),
    ).rejects.toThrow(RegistryException);
  });

  it("remove() deletes every version and emits RegistryRemoved", async () => {
    const registry = makeRegistry();
    const listener = vi.fn();
    registry.events.on(RegistryEventName.REGISTRY_REMOVED, listener);
    await registry.register({ id: "kie", version: "1.0.0", category: "media" });

    await registry.remove("kie");

    expect(registry.has("kie")).toBe(false);
    expect(listener).toHaveBeenCalledOnce();
  });

  it("remove() throws for an id that is not registered", async () => {
    const registry = makeRegistry();
    await expect(registry.remove("ghost")).rejects.toThrow(RegistryException);
  });

  it("disable() transitions Active → Deprecated", async () => {
    const registry = makeRegistry();
    await registry.register({ id: "kie", version: "1.0.0", category: "media" });
    await registry.disable("kie");
    expect(registry.get("kie", "1.0.0")?.status).toBe(EntryStatus.DEPRECATED);
  });

  it("enable() transitions Deprecated → Active", async () => {
    const registry = makeRegistry();
    await registry.register({ id: "kie", version: "1.0.0", category: "media" });
    await registry.disable("kie");
    await registry.enable("kie");
    expect(registry.get("kie", "1.0.0")?.status).toBe(EntryStatus.ACTIVE);
  });

  it("enable()/disable() reject an invalid transition", async () => {
    const registry = makeRegistry();
    await registry.register(
      { id: "kie", version: "1.0.0", category: "media" },
      { status: EntryStatus.RETIRED },
    );
    await expect(registry.enable("kie")).rejects.toThrow(RegistryException);
  });

  it("enable()/disable() reject an unregistered id", async () => {
    const registry = makeRegistry();
    await expect(registry.enable("ghost")).rejects.toThrow(RegistryException);
  });
});

describe("Registry Loading Test / Hot Reload Test — load()/unload()/reload()", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "aos-registry-load-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("load() registers every manifest in a directory, respecting dependency order", async () => {
    writeFileSync(
      join(dir, "base.json"),
      JSON.stringify({ id: "base", version: "1.0.0", category: "x" }),
    );
    writeFileSync(
      join(dir, "derived.json"),
      JSON.stringify({ id: "derived", version: "1.0.0", category: "x", dependencies: ["base"] }),
    );

    const registry = makeRegistry();
    const loaded = vi.fn();
    registry.events.on(RegistryEventName.REGISTRY_LOADED, loaded);

    await registry.load(dir);

    expect(registry.count).toBe(2);
    expect(loaded).toHaveBeenCalledOnce();
  });

  it("load() throws DependencyException for a circular dependency across the batch", async () => {
    writeFileSync(
      join(dir, "a.json"),
      JSON.stringify({ id: "a", version: "1.0.0", category: "x", dependencies: ["b"] }),
    );
    writeFileSync(
      join(dir, "b.json"),
      JSON.stringify({ id: "b", version: "1.0.0", category: "x", dependencies: ["a"] }),
    );

    const registry = makeRegistry();
    const failed = vi.fn();
    registry.events.on(RegistryEventName.DEPENDENCY_FAILED, failed);

    await expect(registry.load(dir)).rejects.toThrow(DependencyException);
    expect(failed).toHaveBeenCalledOnce();
  });

  it("load() throws when any manifest file fails to parse", async () => {
    writeFileSync(join(dir, "bad.json"), "{ not valid");
    const registry = makeRegistry();
    await expect(registry.load(dir)).rejects.toThrow(RegistryException);
  });

  it("unload() removes a single entry", async () => {
    writeFileSync(
      join(dir, "a.json"),
      JSON.stringify({ id: "a", version: "1.0.0", category: "x" }),
    );
    const registry = makeRegistry();
    await registry.load(dir);
    await registry.unload("a");
    expect(registry.has("a")).toBe(false);
  });

  it("reload() throws when nothing has ever been loaded", async () => {
    const registry = makeRegistry();
    await expect(registry.reload()).rejects.toThrow(RegistryException);
  });

  it("Hot Reload: reload() re-reads the same directory after its contents change, without a Kernel restart", async () => {
    writeFileSync(
      join(dir, "a.json"),
      JSON.stringify({ id: "a", version: "1.0.0", category: "x" }),
    );
    const registry = makeRegistry();
    await registry.load(dir);
    expect(registry.count).toBe(1);

    // Simulate an operator editing the manifest directory while the Registry keeps running.
    writeFileSync(
      join(dir, "b.json"),
      JSON.stringify({ id: "b", version: "1.0.0", category: "x" }),
    );

    const reloaded = vi.fn();
    registry.events.on(RegistryEventName.REGISTRY_RELOADED, reloaded);
    await registry.reload();

    expect(registry.count).toBe(2);
    expect(reloaded).toHaveBeenCalledOnce();
  });

  it("Hot Reload correctly handles a manifest whose version is unchanged across reloads (would otherwise fail VersionValidator)", async () => {
    writeFileSync(
      join(dir, "a.json"),
      JSON.stringify({ id: "a", version: "1.0.0", category: "x" }),
    );
    const registry = makeRegistry();
    await registry.load(dir);
    await expect(registry.reload()).resolves.toBeUndefined();
    expect(registry.versions("a")).toEqual(["1.0.0"]);
  });
});
