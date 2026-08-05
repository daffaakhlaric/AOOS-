import { describe, expect, it, vi } from "vitest";

import { ModuleException } from "../../src/errors/index.js";
import type { IModule } from "../../src/interfaces/i-module.js";
import { ModuleLoader } from "../../src/startup/module-loader.js";

function makeModule(name: string, dependencies: readonly string[] = []): IModule {
  return { name, version: "1.0.0", dependencies };
}

describe("ModuleLoader", () => {
  it("registers and loads a module with no dependencies", async () => {
    const loader = new ModuleLoader();
    loader.register(makeModule("a"));

    await loader.load("a");

    expect(loader.loadedCount).toBe(1);
    expect(loader.get("a")?.name).toBe("a");
  });

  it("loading twice is idempotent (does not re-invoke onLoaded)", async () => {
    const onLoaded = vi.fn();
    const loader = new ModuleLoader({ onLoaded });
    loader.register(makeModule("a"));

    await loader.load("a");
    await loader.load("a");

    expect(onLoaded).toHaveBeenCalledTimes(1);
  });

  it("loads a module's dependencies first", async () => {
    const order: string[] = [];
    const loader = new ModuleLoader({ onLoaded: (m) => order.push(m.name) });
    loader.register(makeModule("base"));
    loader.register(makeModule("derived", ["base"]));

    await loader.load("derived");

    expect(order).toEqual(["base", "derived"]);
  });

  it("loadAll() loads every registered module respecting dependency order", async () => {
    const order: string[] = [];
    const loader = new ModuleLoader({ onLoaded: (m) => order.push(m.name) });
    loader.register(makeModule("b", ["a"]));
    loader.register(makeModule("a"));

    await loader.loadAll();

    expect(loader.loadedCount).toBe(2);
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
  });

  it("throws ModuleException registering a duplicate module name", () => {
    const loader = new ModuleLoader();
    loader.register(makeModule("dup"));
    expect(() => loader.register(makeModule("dup"))).toThrow(ModuleException);
  });

  it("throws ModuleException loading an unregistered module", async () => {
    const loader = new ModuleLoader();
    await expect(loader.load("missing")).rejects.toThrow(ModuleException);
  });

  it("throws ModuleException when a dependency is not registered", async () => {
    const loader = new ModuleLoader();
    loader.register(makeModule("orphan", ["ghost"]));
    await expect(loader.load("orphan")).rejects.toThrow(/unregistered module "ghost"/);
  });

  it("throws ModuleException on a circular module dependency", async () => {
    const loader = new ModuleLoader();
    loader.register(makeModule("a", ["b"]));
    loader.register(makeModule("b", ["a"]));
    await expect(loader.load("a")).rejects.toThrow(/Circular module dependency/);
  });

  it("unload() removes a module from the loaded set", async () => {
    const loader = new ModuleLoader();
    loader.register(makeModule("a"));
    await loader.load("a");
    await loader.unload("a");
    expect(loader.loadedCount).toBe(0);
  });

  it("unload() throws ModuleException for a module that is not loaded", async () => {
    const loader = new ModuleLoader();
    loader.register(makeModule("a"));
    await expect(loader.unload("a")).rejects.toThrow(ModuleException);
  });

  it("list() returns only loaded modules", async () => {
    const loader = new ModuleLoader();
    loader.register(makeModule("a"));
    loader.register(makeModule("b"));
    await loader.load("a");
    expect(loader.list().map((m) => m.name)).toEqual(["a"]);
  });
});
