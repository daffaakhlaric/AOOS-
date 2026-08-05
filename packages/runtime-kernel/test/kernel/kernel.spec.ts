import type { IsoDateTime, Uuid } from "@aos/types";
import { describe, expect, it, vi } from "vitest";

import { CapabilityRegistry } from "../../src/capabilities/index.js";
import { ServiceContainer } from "../../src/container/index.js";
import type { RuntimeContext } from "../../src/context/index.js";
import { DiagnosticsService } from "../../src/diagnostics/index.js";
import { BootstrapException } from "../../src/errors/index.js";
import { KernelEventEmitter } from "../../src/events/index.js";
import { KernelHealthService } from "../../src/health/index.js";
import { HookRegistry } from "../../src/hooks/index.js";
import type { IConfigurationProvider } from "../../src/interfaces/i-configuration-provider.js";
import type { IModuleLoader } from "../../src/interfaces/i-module-loader.js";
import type { IPluginLoader } from "../../src/interfaces/i-plugin-loader.js";
import { Kernel, type KernelDependencies } from "../../src/kernel/kernel.js";
import { LifecycleManager } from "../../src/lifecycle/index.js";
import { KernelMetricsCollector } from "../../src/metrics/index.js";
import { ShutdownSequence } from "../../src/shutdown/shutdown-sequence.js";
import { SignalHandler } from "../../src/shutdown/signal-handler.js";
import { StartupSequence } from "../../src/startup/startup-sequence.js";
import { KernelState } from "../../src/types/index.js";

function fakeConfiguration(
  load: () => Promise<Record<string, unknown>> = async () => ({}),
): IConfigurationProvider {
  let isLoaded = false;
  return {
    load: vi.fn(async () => {
      const value = await load();
      isLoaded = true;
      return value;
    }),
    get: vi.fn(() =>
      isLoaded
        ? {}
        : (() => {
            throw new Error("not loaded");
          })(),
    ),
    reload: vi.fn(async () => load()),
    override: vi.fn(),
  };
}

function fakeModuleLoader(loadAll: () => Promise<void> = async () => undefined): IModuleLoader {
  return {
    register: vi.fn(),
    load: vi.fn().mockResolvedValue(undefined),
    loadAll: vi.fn(loadAll),
    unload: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    list: vi.fn().mockReturnValue([]),
    loadedCount: 0,
  };
}

function fakePluginLoader(loadAll: () => Promise<void> = async () => undefined): IPluginLoader {
  return {
    register: vi.fn(),
    load: vi.fn().mockResolvedValue(undefined),
    loadAll: vi.fn(loadAll),
    unload: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    list: vi.fn().mockReturnValue([]),
    loadedCount: 0,
  };
}

interface TestKernelOptions {
  readonly configurationLoad?: () => Promise<Record<string, unknown>>;
  readonly moduleLoadAll?: () => Promise<void>;
  readonly pluginLoadAll?: () => Promise<void>;
  readonly shutdownTimeoutMs?: number;
}

function buildTestKernel(options: TestKernelOptions = {}): Kernel {
  const runtimeContext: RuntimeContext = {
    kernelId: "kernel-under-test" as Uuid<"KernelId">,
    kernelName: "test-kernel",
    kernelVersion: "0.0.1-test",
    environment: "test",
    startedAt: new Date().toISOString() as IsoDateTime,
  };

  const configuration = fakeConfiguration(options.configurationLoad);
  const moduleLoader = fakeModuleLoader(options.moduleLoadAll);
  const pluginLoader = fakePluginLoader(options.pluginLoadAll);
  const events = new KernelEventEmitter();
  const health = new KernelHealthService(() => kernel.state);

  const deps: KernelDependencies = {
    runtimeContext,
    container: new ServiceContainer(),
    events,
    hooks: new HookRegistry(),
    health,
    diagnostics: new DiagnosticsService({
      runtimeContext,
      getState: () => kernel.state,
      getModuleCount: () => moduleLoader.loadedCount,
      getPluginCount: () => pluginLoader.loadedCount,
      getConfigurationStatus: () => "not_loaded",
      getHealthSummary: async () => (await health.check()).status,
    }),
    metrics: new KernelMetricsCollector({
      startedAt: new Date(runtimeContext.startedAt),
      getModuleCount: () => moduleLoader.loadedCount,
      getPluginCount: () => pluginLoader.loadedCount,
      getHealthReport: () => health.check(),
    }),
    capabilities: new CapabilityRegistry(),
    lifecycle: new LifecycleManager(),
    startupSequence: new StartupSequence({ configuration, moduleLoader, pluginLoader }),
    shutdownSequence: new ShutdownSequence(options.shutdownTimeoutMs ?? 1000),
    signalHandler: new SignalHandler(["SIGUSR2"]),
    moduleLoader,
    pluginLoader,
    configuration,
  };

  const kernel = new Kernel(deps);
  return kernel;
}

describe("Bootstrap Test — Kernel.start()", () => {
  it("walks Created → Running through every intermediate state, emitting KernelStarted", async () => {
    const kernel = buildTestKernel();
    const started = vi.fn();
    kernel.events.on("kernel.started" as never, started);

    await kernel.start();

    expect(kernel.state).toBe(KernelState.RUNNING);
    expect(started).toHaveBeenCalledOnce();
  });

  it("rejects starting from a non-startable state", async () => {
    const kernel = buildTestKernel();
    await kernel.start();
    await expect(kernel.start()).rejects.toThrow(BootstrapException);
  });

  it("transitions to FAILED and emits KernelFailed when configuration loading throws", async () => {
    const kernel = buildTestKernel({
      configurationLoad: async () => {
        throw new Error("bad config");
      },
    });
    const failed = vi.fn();
    kernel.events.on("kernel.failed" as never, failed);

    await expect(kernel.start()).rejects.toThrow();
    expect(kernel.state).toBe(KernelState.FAILED);
    expect(failed).toHaveBeenCalledOnce();
  });

  it("transitions to FAILED when module loading throws", async () => {
    const kernel = buildTestKernel({
      moduleLoadAll: async () => {
        throw new Error("bad module");
      },
    });
    await expect(kernel.start()).rejects.toThrow();
    expect(kernel.state).toBe(KernelState.FAILED);
  });

  it("records a boot time metric once started", async () => {
    const kernel = buildTestKernel();
    await kernel.start();
    const metrics = await kernel.metrics();
    expect(metrics.bootTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("exposes container/events/capabilities/loaders/configuration accessors", () => {
    const kernel = buildTestKernel();
    expect(kernel.container).toBeDefined();
    expect(kernel.events).toBeDefined();
    expect(kernel.capabilities).toBeDefined();
    expect(kernel.moduleLoader).toBeDefined();
    expect(kernel.pluginLoader).toBeDefined();
    expect(kernel.configuration).toBeDefined();
  });
});

describe("Shutdown Test — Kernel.stop()", () => {
  it("walks Running → Stopped, emitting KernelStopped", async () => {
    const kernel = buildTestKernel();
    await kernel.start();

    const stopped = vi.fn();
    kernel.events.on("kernel.stopped" as never, stopped);
    await kernel.stop();

    expect(kernel.state).toBe(KernelState.STOPPED);
    expect(stopped).toHaveBeenCalledOnce();
  });

  it("rejects stopping from a non-stoppable state", async () => {
    const kernel = buildTestKernel();
    await expect(kernel.stop()).rejects.toThrow(BootstrapException);
  });

  it("runs onStopping/onShutdown lifecycle phases for registered participants", async () => {
    const kernel = buildTestKernel();
    const calls: string[] = [];
    (kernel as unknown as { deps: { lifecycle: LifecycleManager } }).deps.lifecycle.register({
      onStopping: () => void calls.push("stopping"),
      onShutdown: () => void calls.push("shutdown"),
    });

    await kernel.start();
    await kernel.stop();

    expect(calls).toEqual(["stopping", "shutdown"]);
  });
});

describe("Restart Test — Kernel.restart()", () => {
  it("restarts a running Kernel back to RUNNING, stopping first", async () => {
    const kernel = buildTestKernel();
    await kernel.start();

    const stopped = vi.fn();
    const started = vi.fn();
    kernel.events.on("kernel.stopped" as never, stopped);
    kernel.events.on("kernel.started" as never, started);

    await kernel.restart();

    expect(kernel.state).toBe(KernelState.RUNNING);
    expect(stopped).toHaveBeenCalledOnce();
    expect(started).toHaveBeenCalledOnce();
  });

  it("restarts directly from STOPPED without calling stop() again", async () => {
    const kernel = buildTestKernel();
    await kernel.start();
    await kernel.stop();

    await kernel.restart();
    expect(kernel.state).toBe(KernelState.RUNNING);
  });

  it("rejects restarting from CREATED", async () => {
    const kernel = buildTestKernel();
    await expect(kernel.restart()).rejects.toThrow(BootstrapException);
  });
});

describe("Kernel.dispose()", () => {
  it("requires the Kernel to be STOPPED first", async () => {
    const kernel = buildTestKernel();
    await expect(kernel.dispose()).rejects.toThrow(BootstrapException);
  });

  it("runs onDispose and clears all event listeners", async () => {
    const kernel = buildTestKernel();
    await kernel.start();
    await kernel.stop();

    const listener = vi.fn();
    kernel.events.on("kernel.started" as never, listener);
    await kernel.dispose();

    kernel.events.emit("kernel.started" as never, {
      startedAt: new Date().toISOString() as IsoDateTime,
    });
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("Kernel.reload()", () => {
  it("requires RUNNING state", async () => {
    const kernel = buildTestKernel();
    await expect(kernel.reload()).rejects.toThrow(BootstrapException);
  });

  it("reloads configuration and returns to RUNNING, emitting ConfigurationReloaded and KernelReloaded", async () => {
    const kernel = buildTestKernel();
    await kernel.start();

    const configReloaded = vi.fn();
    const kernelReloaded = vi.fn();
    kernel.events.on("kernel.configuration_reloaded" as never, configReloaded);
    kernel.events.on("kernel.reloaded" as never, kernelReloaded);

    await kernel.reload();

    expect(kernel.state).toBe(KernelState.RUNNING);
    expect(configReloaded).toHaveBeenCalledOnce();
    expect(kernelReloaded).toHaveBeenCalledOnce();
  });
});

describe("Kernel health/diagnostics/metrics convenience methods", () => {
  it("checkHealth() emits HealthChanged only when the status actually changes", async () => {
    const kernel = buildTestKernel();
    const changed = vi.fn();
    kernel.events.on("kernel.health_changed" as never, changed);

    await kernel.checkHealth(); // first call establishes baseline, no prior status to compare
    await kernel.checkHealth(); // status unchanged (still healthy) — no event

    expect(changed).not.toHaveBeenCalled();
  });

  it("isLive()/isReady() reflect the underlying health service", async () => {
    const kernel = buildTestKernel();
    expect(kernel.isLive()).toBe(false);
    await kernel.start();
    expect(kernel.isLive()).toBe(true);
    expect(kernel.isReady()).toBe(true);
  });

  it("diagnostics() returns a RuntimeInfo snapshot", async () => {
    const kernel = buildTestKernel();
    const info = await kernel.diagnostics();
    expect(info.kernelName).toBe("test-kernel");
    expect(info.state).toBe(KernelState.CREATED);
  });
});

describe("Kernel.registerSignalHandlers()", () => {
  it("wires the configured signal to trigger a graceful stop()", async () => {
    const kernel = buildTestKernel();
    await kernel.start();
    kernel.registerSignalHandlers();

    try {
      process.emit("SIGUSR2");
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(kernel.state).toBe(KernelState.STOPPED);
    } finally {
      (
        kernel as unknown as { deps: { signalHandler: SignalHandler } }
      ).deps.signalHandler.unregister();
    }
  });
});
