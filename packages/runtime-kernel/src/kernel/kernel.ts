import type { HealthReport, HealthStatus } from "@aos/telemetry";
import type { IsoDateTime } from "@aos/types";

import type { CapabilityRegistry } from "../capabilities/index.js";
import type { RuntimeContext } from "../context/index.js";
import type { DiagnosticsService, RuntimeInfo } from "../diagnostics/index.js";
import { BootstrapException } from "../errors/index.js";
import type { KernelEventEmitter } from "../events/index.js";
import type { KernelHealthService } from "../health/index.js";
import type { HookRegistry } from "../hooks/index.js";
import type { IConfigurationProvider } from "../interfaces/i-configuration-provider.js";
import type { IKernel } from "../interfaces/i-kernel.js";
import type { IModuleLoader } from "../interfaces/i-module-loader.js";
import type { IPluginLoader } from "../interfaces/i-plugin-loader.js";
import type { IServiceContainer } from "../interfaces/i-service-container.js";
import type { LifecycleManager } from "../lifecycle/index.js";
import type { KernelMetricsCollector, KernelMetricsSnapshot } from "../metrics/index.js";
import type { ShutdownSequence } from "../shutdown/shutdown-sequence.js";
import type { SignalHandler } from "../shutdown/signal-handler.js";
import type { StartupSequence } from "../startup/startup-sequence.js";
import { HookName, KernelEventName, KernelState } from "../types/index.js";
import { now } from "../utils/index.js";

import { KernelStateMachine } from "./kernel-state-machine.js";

export interface KernelDependencies {
  readonly runtimeContext: RuntimeContext;
  readonly container: IServiceContainer;
  readonly events: KernelEventEmitter;
  readonly hooks: HookRegistry;
  readonly health: KernelHealthService;
  readonly diagnostics: DiagnosticsService;
  readonly metrics: KernelMetricsCollector;
  readonly capabilities: CapabilityRegistry;
  readonly lifecycle: LifecycleManager;
  readonly startupSequence: StartupSequence;
  readonly shutdownSequence: ShutdownSequence;
  readonly signalHandler: SignalHandler;
  readonly moduleLoader: IModuleLoader;
  readonly pluginLoader: IPluginLoader;
  readonly configuration: IConfigurationProvider;
}

const STARTABLE_STATES: readonly KernelState[] = [KernelState.CREATED, KernelState.STOPPED];
const STOPPABLE_STATES: readonly KernelState[] = [KernelState.READY, KernelState.RUNNING];
const RESTARTABLE_STATES: readonly KernelState[] = [
  KernelState.RUNNING,
  KernelState.READY,
  KernelState.STOPPED,
  KernelState.FAILED,
];

/**
 * The AOS Runtime Kernel. Every collaborator (container, events, hooks, health, diagnostics,
 * metrics, capabilities, lifecycle, startup/shutdown sequences, loaders, configuration) is
 * injected, never constructed internally — see bootstrap/kernel-builder.ts for composition.
 * This keeps the Kernel itself a pure orchestrator over its state machine, testable in
 * complete isolation with fake collaborators.
 */
export class Kernel implements IKernel {
  readonly context: RuntimeContext;
  private readonly stateMachine = new KernelStateMachine();
  private lastHealthStatus: HealthStatus | undefined;

  constructor(private readonly deps: KernelDependencies) {
    this.context = deps.runtimeContext;
  }

  get state(): KernelState {
    return this.stateMachine.state;
  }

  get container(): IServiceContainer {
    return this.deps.container;
  }

  get events(): KernelEventEmitter {
    return this.deps.events;
  }

  get capabilities(): CapabilityRegistry {
    return this.deps.capabilities;
  }

  get moduleLoader(): IModuleLoader {
    return this.deps.moduleLoader;
  }

  get pluginLoader(): IPluginLoader {
    return this.deps.pluginLoader;
  }

  get configuration(): IConfigurationProvider {
    return this.deps.configuration;
  }

  async start(): Promise<void> {
    if (!STARTABLE_STATES.includes(this.state)) {
      throw new BootstrapException(`Cannot start Kernel from state "${this.state}"`);
    }
    await this.deps.hooks.run(HookName.BEFORE_START, this.context);
    this.stateMachine.transitionTo(KernelState.BOOTING);
    await this.executeStartupPipeline();
  }

  async stop(): Promise<void> {
    if (!STOPPABLE_STATES.includes(this.state)) {
      throw new BootstrapException(`Cannot stop Kernel from state "${this.state}"`);
    }
    try {
      await this.deps.hooks.run(HookName.BEFORE_STOP, this.context);
      this.stateMachine.transitionTo(KernelState.STOPPING);
      await this.deps.lifecycle.runStopping(this.context);

      await this.deps.shutdownSequence.run([
        async () => {
          await this.deps.lifecycle.runShutdown(this.context);
        },
      ]);

      this.stateMachine.transitionTo(KernelState.STOPPED);
      this.deps.events.emit(KernelEventName.KERNEL_STOPPED, {
        stoppedAt: new Date().toISOString() as IsoDateTime,
      });
      await this.deps.hooks.run(HookName.AFTER_STOP, this.context);
    } catch (error) {
      this.failWith(error);
    }
  }

  async restart(): Promise<void> {
    if (!RESTARTABLE_STATES.includes(this.state)) {
      throw new BootstrapException(`Cannot restart Kernel from state "${this.state}"`);
    }
    if (this.state === KernelState.RUNNING || this.state === KernelState.READY) {
      await this.stop();
    }
    this.stateMachine.transitionTo(KernelState.RESTARTING);
    this.stateMachine.transitionTo(KernelState.BOOTING);
    await this.executeStartupPipeline();
  }

  async dispose(): Promise<void> {
    if (this.state !== KernelState.STOPPED) {
      throw new BootstrapException(
        `Cannot dispose Kernel from state "${this.state}" — stop() first`,
      );
    }
    await this.deps.lifecycle.runDispose(this.context);
    this.deps.signalHandler.unregister();
    this.deps.events.removeAllListeners();
  }

  async reload(): Promise<void> {
    if (this.state !== KernelState.RUNNING) {
      throw new BootstrapException(
        `Cannot reload Kernel from state "${this.state}" — must be RUNNING`,
      );
    }
    await this.deps.hooks.run(HookName.BEFORE_RELOAD, this.context);
    this.stateMachine.transitionTo(KernelState.LOADING_CONFIGURATION);
    try {
      await this.deps.startupSequence.loadConfiguration();
    } catch (error) {
      this.failWith(error);
      return;
    }
    this.stateMachine.transitionTo(KernelState.RUNNING);
    const reloadedAt = new Date().toISOString() as IsoDateTime;
    this.deps.events.emit(KernelEventName.CONFIGURATION_RELOADED, { reloadedAt });
    this.deps.events.emit(KernelEventName.KERNEL_RELOADED, { reloadedAt });
    await this.deps.hooks.run(HookName.AFTER_RELOAD, this.context);
  }

  /** Opt-in — wires SIGINT/SIGTERM to a graceful stop(). Never called automatically. */
  registerSignalHandlers(): void {
    this.deps.signalHandler.register(async () => {
      await this.stop();
    });
  }

  async checkHealth(): Promise<HealthReport> {
    const report = await this.deps.health.check();
    if (this.lastHealthStatus !== undefined && this.lastHealthStatus !== report.status) {
      this.deps.events.emit(KernelEventName.HEALTH_CHANGED, { status: report.status });
    }
    this.lastHealthStatus = report.status;
    return report;
  }

  isLive(): boolean {
    return this.deps.health.isLive();
  }

  isReady(): boolean {
    return this.deps.health.isReady();
  }

  async diagnostics(): Promise<RuntimeInfo> {
    return this.deps.diagnostics.snapshot();
  }

  async metrics(): Promise<KernelMetricsSnapshot> {
    return this.deps.metrics.snapshot();
  }

  private async executeStartupPipeline(): Promise<void> {
    const bootStart = now();
    try {
      this.stateMachine.transitionTo(KernelState.LOADING_CONFIGURATION);
      await this.deps.startupSequence.loadConfiguration();

      this.stateMachine.transitionTo(KernelState.LOADING_MODULES);
      await this.deps.startupSequence.loadModules();

      this.stateMachine.transitionTo(KernelState.LOADING_PLUGINS);
      await this.deps.startupSequence.loadPlugins();

      // Modules/Plugins only become Lifecycle participants once loaded (see
      // startup/module-loader.ts's onLoaded callback in bootstrap/kernel-builder.ts) — so
      // OnBootstrap fires here, after loading, not before it.
      await this.deps.lifecycle.runBootstrap(this.context);

      this.stateMachine.transitionTo(KernelState.READY);
      await this.deps.lifecycle.runReady(this.context);

      this.stateMachine.transitionTo(KernelState.RUNNING);
      await this.deps.lifecycle.runRunning(this.context);

      this.deps.metrics.recordBootTime(now() - bootStart);
      this.deps.events.emit(KernelEventName.KERNEL_STARTED, {
        startedAt: new Date().toISOString() as IsoDateTime,
      });
      await this.deps.hooks.run(HookName.AFTER_START, this.context);
    } catch (error) {
      this.failWith(error);
    }
  }

  private failWith(error: unknown): never {
    this.stateMachine.transitionTo(KernelState.FAILED);
    this.deps.events.emit(KernelEventName.KERNEL_FAILED, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
