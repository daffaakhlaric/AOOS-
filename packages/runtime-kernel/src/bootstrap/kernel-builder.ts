import type { IsoDateTime, Uuid } from "@aos/types";

import { CapabilityRegistry } from "../capabilities/index.js";
import { ServiceContainer } from "../container/index.js";
import type { RuntimeContext } from "../context/index.js";
import type { KernelOptions } from "../contracts/kernel-options.js";
import { DiagnosticsService, type ConfigurationStatus } from "../diagnostics/index.js";
import { KernelEventEmitter } from "../events/index.js";
import { KernelHealthService } from "../health/index.js";
import { HookRegistry } from "../hooks/index.js";
import { Kernel, type KernelDependencies } from "../kernel/kernel.js";
import { LifecycleManager } from "../lifecycle/index.js";
import { KernelMetricsCollector } from "../metrics/index.js";
import { ShutdownSequence } from "../shutdown/shutdown-sequence.js";
import { SignalHandler } from "../shutdown/signal-handler.js";
import {
  ConfigurationService,
  ModuleLoader,
  PluginLoader,
  StartupSequence,
} from "../startup/index.js";
import { KernelEventName } from "../types/index.js";
import { generateId } from "../utils/index.js";
import { KERNEL_VERSION } from "../version/index.js";

/**
 * The Kernel composition root — the one place every collaborator (container, events, hooks,
 * health, diagnostics, metrics, capabilities, lifecycle, startup/shutdown, loaders,
 * configuration) is constructed and wired together, then injected into a single Kernel
 * instance. Application code should call this instead of `new Kernel(...)` directly.
 */
export function buildKernel(options: KernelOptions = {}): Kernel {
  const runtimeContext: RuntimeContext = {
    kernelId: generateId() as Uuid<"KernelId">,
    kernelName: options.name ?? "aos-runtime-kernel",
    kernelVersion: options.version ?? KERNEL_VERSION,
    environment: options.environment ?? process.env.NODE_ENV ?? "development",
    startedAt: new Date().toISOString() as IsoDateTime,
  };

  const container = new ServiceContainer();
  const events = new KernelEventEmitter();
  const hooks = new HookRegistry();
  const capabilities = new CapabilityRegistry();
  const lifecycle = new LifecycleManager();
  const signalHandler = new SignalHandler();
  const shutdownSequence = new ShutdownSequence(options.shutdownTimeoutMs);

  const configuration = new ConfigurationService({
    schema: options.configSchema,
    secretProvider: options.secretProvider,
  });

  const moduleLoader = new ModuleLoader({
    onLoaded: (module) => {
      lifecycle.register(module);
      events.emit(KernelEventName.MODULE_LOADED, { name: module.name, version: module.version });
    },
  });

  const pluginLoader = new PluginLoader({
    container,
    onLoaded: (plugin) => {
      events.emit(KernelEventName.PLUGIN_LOADED, { name: plugin.name, version: plugin.version });
    },
  });

  for (const module of options.modules ?? []) {
    moduleLoader.register(module);
  }
  for (const plugin of options.plugins ?? []) {
    pluginLoader.register(plugin);
  }

  const startupSequence = new StartupSequence({ configuration, moduleLoader, pluginLoader });

  // `kernelRef` is assigned once, immediately after construction below — health/diagnostics
  // only invoke this closure lazily (on check()/snapshot() calls), never during construction,
  // so the temporal-dead-zone-looking forward reference is safe in practice. `let` (not
  // `const`) is required: the closures below capture this binding before Kernel exists.
  // eslint-disable-next-line prefer-const
  let kernelRef: Kernel;
  const health = new KernelHealthService(() => kernelRef.state);

  const diagnostics = new DiagnosticsService({
    runtimeContext,
    getState: () => kernelRef.state,
    getModuleCount: () => moduleLoader.loadedCount,
    getPluginCount: () => pluginLoader.loadedCount,
    getConfigurationStatus: (): ConfigurationStatus =>
      configuration.isLoaded ? "loaded" : "not_loaded",
    getHealthSummary: async () => (await health.check()).status,
  });

  const metrics = new KernelMetricsCollector({
    startedAt: new Date(runtimeContext.startedAt),
    getModuleCount: () => moduleLoader.loadedCount,
    getPluginCount: () => pluginLoader.loadedCount,
    getHealthReport: () => health.check(),
  });

  const dependencies: KernelDependencies = {
    runtimeContext,
    container,
    events,
    hooks,
    health,
    diagnostics,
    metrics,
    capabilities,
    lifecycle,
    startupSequence,
    shutdownSequence,
    signalHandler,
    moduleLoader,
    pluginLoader,
    configuration,
  };

  const kernel = new Kernel(dependencies);
  kernelRef = kernel;
  return kernel;
}
