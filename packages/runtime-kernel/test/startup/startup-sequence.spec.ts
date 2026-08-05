import { describe, expect, it, vi } from "vitest";

import { BootstrapException } from "../../src/errors/index.js";
import type { IConfigurationProvider } from "../../src/interfaces/i-configuration-provider.js";
import type { IModuleLoader } from "../../src/interfaces/i-module-loader.js";
import type { IPluginLoader } from "../../src/interfaces/i-plugin-loader.js";
import { StartupSequence } from "../../src/startup/startup-sequence.js";

function fakeConfiguration(
  overrides: Partial<IConfigurationProvider> = {},
): IConfigurationProvider {
  return {
    load: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockReturnValue({}),
    reload: vi.fn().mockResolvedValue({}),
    override: vi.fn(),
    ...overrides,
  };
}

function fakeModuleLoader(overrides: Partial<IModuleLoader> = {}): IModuleLoader {
  return {
    register: vi.fn(),
    load: vi.fn().mockResolvedValue(undefined),
    loadAll: vi.fn().mockResolvedValue(undefined),
    unload: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    list: vi.fn().mockReturnValue([]),
    loadedCount: 0,
    ...overrides,
  };
}

function fakePluginLoader(overrides: Partial<IPluginLoader> = {}): IPluginLoader {
  return {
    register: vi.fn(),
    load: vi.fn().mockResolvedValue(undefined),
    loadAll: vi.fn().mockResolvedValue(undefined),
    unload: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    list: vi.fn().mockReturnValue([]),
    loadedCount: 0,
    ...overrides,
  };
}

describe("StartupSequence", () => {
  it("loadConfiguration() delegates to the configuration provider", async () => {
    const configuration = fakeConfiguration();
    const sequence = new StartupSequence({
      configuration,
      moduleLoader: fakeModuleLoader(),
      pluginLoader: fakePluginLoader(),
    });

    await sequence.loadConfiguration();
    expect(configuration.load).toHaveBeenCalledOnce();
  });

  it("wraps a configuration load failure in a BootstrapException", async () => {
    const configuration = fakeConfiguration({
      load: vi.fn().mockRejectedValue(new Error("bad config")),
    });
    const sequence = new StartupSequence({
      configuration,
      moduleLoader: fakeModuleLoader(),
      pluginLoader: fakePluginLoader(),
    });

    await expect(sequence.loadConfiguration()).rejects.toThrow(BootstrapException);
  });

  it("loadModules() delegates to the module loader and wraps failures", async () => {
    const moduleLoader = fakeModuleLoader();
    const sequence = new StartupSequence({
      configuration: fakeConfiguration(),
      moduleLoader,
      pluginLoader: fakePluginLoader(),
    });
    await sequence.loadModules();
    expect(moduleLoader.loadAll).toHaveBeenCalledOnce();

    const failingSequence = new StartupSequence({
      configuration: fakeConfiguration(),
      moduleLoader: fakeModuleLoader({
        loadAll: vi.fn().mockRejectedValue(new Error("bad module")),
      }),
      pluginLoader: fakePluginLoader(),
    });
    await expect(failingSequence.loadModules()).rejects.toThrow(BootstrapException);
  });

  it("loadPlugins() delegates to the plugin loader and wraps failures", async () => {
    const pluginLoader = fakePluginLoader();
    const sequence = new StartupSequence({
      configuration: fakeConfiguration(),
      moduleLoader: fakeModuleLoader(),
      pluginLoader,
    });
    await sequence.loadPlugins();
    expect(pluginLoader.loadAll).toHaveBeenCalledOnce();

    const failingSequence = new StartupSequence({
      configuration: fakeConfiguration(),
      moduleLoader: fakeModuleLoader(),
      pluginLoader: fakePluginLoader({
        loadAll: vi.fn().mockRejectedValue(new Error("bad plugin")),
      }),
    });
    await expect(failingSequence.loadPlugins()).rejects.toThrow(BootstrapException);
  });
});
