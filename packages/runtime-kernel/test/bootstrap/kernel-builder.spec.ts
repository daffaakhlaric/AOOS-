import { afterEach, describe, expect, it, vi } from "vitest";

import { buildKernel } from "../../src/bootstrap/kernel-builder.js";
import type { IModule } from "../../src/interfaces/i-module.js";
import type { IPlugin } from "../../src/interfaces/i-plugin.js";
import { KernelState } from "../../src/types/index.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("buildKernel() — full composition-root integration", () => {
  it("boots to RUNNING using real ConfigurationService/ModuleLoader/PluginLoader/ServiceContainer", async () => {
    process.env.SERVICE_NAME = "runtime-kernel-integration-test";
    const kernel = buildKernel({ name: "integration-kernel", environment: "test" });

    await kernel.start();

    expect(kernel.state).toBe(KernelState.RUNNING);
    expect(kernel.context.kernelName).toBe("integration-kernel");
    await kernel.stop();
  });

  it("loads a real Module (with lifecycle hooks) and a real Plugin (registering into the container)", async () => {
    process.env.SERVICE_NAME = "runtime-kernel-integration-test";
    const bootstrapSpy = vi.fn();
    const module: IModule = {
      name: "test-module",
      version: "1.0.0",
      onBootstrap: bootstrapSpy,
    };
    const registerSpy = vi.fn((container) => {
      container.registerValue("plugin-provided-value", 42);
    });
    const plugin: IPlugin = {
      name: "test-plugin",
      version: "1.0.0",
      register: registerSpy,
    };

    const kernel = buildKernel({ modules: [module], plugins: [plugin] });
    await kernel.start();

    expect(bootstrapSpy).toHaveBeenCalledOnce();
    expect(registerSpy).toHaveBeenCalledOnce();
    expect(await kernel.container.resolve("plugin-provided-value")).toBe(42);

    const info = await kernel.diagnostics();
    expect(info.loadedModuleCount).toBe(1);
    expect(info.loadedPluginCount).toBe(1);

    await kernel.stop();
  });

  it("emits ModuleLoaded and PluginLoaded events during startup", async () => {
    process.env.SERVICE_NAME = "runtime-kernel-integration-test";
    const module: IModule = { name: "m1", version: "1.0.0" };
    const plugin: IPlugin = { name: "p1", version: "1.0.0" };
    const kernel = buildKernel({ modules: [module], plugins: [plugin] });

    const moduleLoaded = vi.fn();
    const pluginLoaded = vi.fn();
    kernel.events.on("kernel.module_loaded" as never, moduleLoaded);
    kernel.events.on("kernel.plugin_loaded" as never, pluginLoaded);

    await kernel.start();

    expect(moduleLoaded).toHaveBeenCalledOnce();
    expect(pluginLoaded).toHaveBeenCalledOnce();
    await kernel.stop();
  });

  it("fails to start when required configuration (SERVICE_NAME) is missing", async () => {
    delete process.env.SERVICE_NAME;
    const kernel = buildKernel({ name: "unconfigured-kernel" });

    await expect(kernel.start()).rejects.toThrow();
    expect(kernel.state).toBe(KernelState.FAILED);
  });

  it("defaults kernelName/kernelVersion/environment sensibly when no options are given", () => {
    const kernel = buildKernel();
    expect(kernel.context.kernelName).toBe("aos-runtime-kernel");
    expect(kernel.context.kernelVersion).toBe("0.1.0");
  });

  it("full lifecycle: start → checkHealth → diagnostics → metrics → stop → dispose", async () => {
    process.env.SERVICE_NAME = "runtime-kernel-integration-test";
    const kernel = buildKernel();

    await kernel.start();
    const health = await kernel.checkHealth();
    expect(health.status).toBe("healthy");

    const metrics = await kernel.metrics();
    expect(metrics.uptimeMs).toBeGreaterThanOrEqual(0);

    await kernel.stop();
    await kernel.dispose();
  });
});
