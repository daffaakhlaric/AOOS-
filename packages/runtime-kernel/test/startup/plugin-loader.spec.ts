import { describe, expect, it, vi } from "vitest";

import { ServiceContainer } from "../../src/container/service-container.js";
import { ModuleException } from "../../src/errors/index.js";
import type { IPlugin } from "../../src/interfaces/i-plugin.js";
import { PluginLoader } from "../../src/startup/plugin-loader.js";

describe("PluginLoader", () => {
  it("registers and loads a plugin, invoking its optional register(container) hook", async () => {
    const container = new ServiceContainer();
    const registerSpy = vi.fn();
    const plugin: IPlugin = { name: "p1", version: "1.0.0", register: registerSpy };

    const loader = new PluginLoader({ container });
    loader.register(plugin);
    await loader.load("p1");

    expect(registerSpy).toHaveBeenCalledWith(container);
    expect(loader.loadedCount).toBe(1);
  });

  it("supports a plugin with no register() hook", async () => {
    const loader = new PluginLoader({ container: new ServiceContainer() });
    loader.register({ name: "no-op", version: "1.0.0" });
    await expect(loader.load("no-op")).resolves.toBeUndefined();
  });

  it("loading twice is idempotent", async () => {
    const onLoaded = vi.fn();
    const loader = new PluginLoader({ container: new ServiceContainer(), onLoaded });
    loader.register({ name: "p1", version: "1.0.0" });

    await loader.load("p1");
    await loader.load("p1");

    expect(onLoaded).toHaveBeenCalledTimes(1);
  });

  it("loadAll() loads every registered plugin", async () => {
    const loader = new PluginLoader({ container: new ServiceContainer() });
    loader.register({ name: "a", version: "1.0.0" });
    loader.register({ name: "b", version: "1.0.0" });

    await loader.loadAll();

    expect(loader.loadedCount).toBe(2);
  });

  it("throws ModuleException registering a duplicate plugin name", () => {
    const loader = new PluginLoader({ container: new ServiceContainer() });
    loader.register({ name: "dup", version: "1.0.0" });
    expect(() => loader.register({ name: "dup", version: "1.0.0" })).toThrow(ModuleException);
  });

  it("throws ModuleException loading an unregistered plugin", async () => {
    const loader = new PluginLoader({ container: new ServiceContainer() });
    await expect(loader.load("missing")).rejects.toThrow(ModuleException);
  });

  it("unload() removes a plugin from the loaded set; throws if not loaded", async () => {
    const loader = new PluginLoader({ container: new ServiceContainer() });
    loader.register({ name: "a", version: "1.0.0" });
    await expect(loader.unload("a")).rejects.toThrow(ModuleException);

    await loader.load("a");
    await loader.unload("a");
    expect(loader.loadedCount).toBe(0);
  });

  it("list() returns only loaded plugins", async () => {
    const loader = new PluginLoader({ container: new ServiceContainer() });
    loader.register({ name: "a", version: "1.0.0" });
    loader.register({ name: "b", version: "1.0.0" });
    await loader.load("b");
    expect(loader.list().map((p) => p.name)).toEqual(["b"]);
  });
});
