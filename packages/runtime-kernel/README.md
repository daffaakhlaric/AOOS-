# @aos/runtime-kernel

The AOS Runtime Kernel — the framework-agnostic foundation every future AI Agent runtime component builds on. **Not a business application.** No Agent, Workflow, Tool, Registry, Scheduler, Planner, Reasoner, Reflection, Memory Engine, Event Bus, AI Gateway, Tool SDK, Dashboard, or API ships here — see `docs/PROMPT-005.2-CORE-RUNTIME-KERNEL.md` for the explicit scope boundary.

## What the Kernel Does

Bootstrap, lifecycle management, dependency injection, module/plugin loading _mechanics_ (no business modules/plugins ship here), configuration loading, health checks, graceful shutdown, restart, signal handling, service/capability discovery, version compatibility checking, a full Context set (Runtime/Execution/Tenant/User/Request/Trace + Cancellation Token), an in-process Kernel Event system, Kernel Metrics, Kernel Diagnostics, and a Kernel State Machine.

## Architecture

Hexagonal (Ports & Adapters), Dependency Injection, Interface First, Contract First — every collaborator the `Kernel` class depends on is an injected interface/class, never constructed internally. `bootstrap/kernel-builder.ts` is the single composition root; application code calls `buildKernel(options)`, never `new Kernel(...)` directly.

## Folder Structure

| Folder          | Contents                                                                                                                                                         |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kernel/`       | `Kernel` (the orchestrator) + `KernelStateMachine`                                                                                                               |
| `bootstrap/`    | `buildKernel()` — the composition root                                                                                                                           |
| `lifecycle/`    | `LifecycleManager` — invokes `OnBootstrap/OnReady/OnRunning/OnStopping/OnShutdown/OnDispose` across registered Modules/Plugins                                   |
| `context/`      | `RuntimeContext`, `ExecutionContext`, `TenantContext`, `UserContext`, `RequestContext`, `TraceContext`, `CancellationToken`, AsyncLocalStorage-based propagation |
| `container/`    | `ServiceContainer` — token-based DI with singleton/scoped/transient lifetimes, lazy resolution, circular dependency detection                                    |
| `hooks/`        | `HookRegistry` — `BeforeStart/AfterStart/BeforeStop/AfterStop/BeforeReload/AfterReload`                                                                          |
| `health/`       | `KernelHealthService` — wraps `@aos/telemetry`'s `HealthCheckRegistry`, adds memory/CPU checks, readiness/liveness                                               |
| `diagnostics/`  | `DiagnosticsService` — `RuntimeInfo` snapshot                                                                                                                    |
| `capabilities/` | `CapabilityRegistry` — capability/service discovery                                                                                                              |
| `version/`      | `KERNEL_VERSION`, `isVersionCompatible`/`compareVersions` (via `semver`)                                                                                         |
| `shutdown/`     | `ShutdownSequence` (timeout-enforced drain), `SignalHandler` (opt-in SIGINT/SIGTERM wiring)                                                                      |
| `startup/`      | `ConfigurationService`, `ModuleLoader`, `PluginLoader`, `StartupSequence`                                                                                        |
| `events/`       | `KernelEventEmitter` — in-process, typed pub/sub for Kernel lifecycle notifications (**not** the platform Event Bus/Event Contract)                              |
| `metrics/`      | `KernelMetricsCollector` — uptime, boot time, memory, module/plugin counts, health score                                                                         |
| `contracts/`    | `ModuleDescriptor`, `PluginDescriptor`, `KernelOptions` — data shapes                                                                                            |
| `interfaces/`   | `IKernel`, `IServiceContainer`, `IModule(Loader)`, `IPlugin(Loader)`, `I(Configuration\|Secret)Provider`, Lifecycle interfaces — behavioral ports                |
| `types/`        | `KernelState` + transition table, `Lifetime`, `HookName`, `KernelEventName`, `Token`                                                                             |
| `errors/`       | `KernelException` + `Configuration/Bootstrap/Module/Lifecycle/DependencyException`                                                                               |
| `utils/`        | `generateId`, `now`/`measureDurationMs`, `safeInvoke`                                                                                                            |

## Kernel State Machine

```
Created → Booting → LoadingConfiguration → LoadingModules → LoadingPlugins → Ready → Running
                                                                                  ↓  ↑
                                                                    (reload() short-circuits
                                                                     LoadingConfiguration → Running)
Running → Stopping → Stopped → Restarting → Booting → ...
(any state) → Failed → Restarting | Stopped
```

See `src/types/kernel-state.ts`'s `KERNEL_STATE_TRANSITIONS` for the authoritative transition graph and `docs/005.2-CORE-RUNTIME-KERNEL-REPORT.md` for the full diagram set.

## Usage

```ts
import { buildKernel } from "@aos/runtime-kernel";

const kernel = buildKernel({ name: "aos-core-runtime" });

await kernel.start(); // Created → ... → Running
await kernel.checkHealth(); // HealthReport
await kernel.diagnostics(); // RuntimeInfo snapshot
await kernel.metrics(); // KernelMetricsSnapshot

kernel.registerSignalHandlers(); // opt-in SIGINT/SIGTERM → graceful stop()

await kernel.stop();
await kernel.dispose();
```

Registering a Module or Plugin (mechanics only — no real Module/Plugin ships in this package):

```ts
import { buildKernel, type IModule, type IPlugin } from "@aos/runtime-kernel";

const module: IModule = {
  name: "example-module",
  version: "1.0.0",
  onBootstrap: async () => {
    /* one-time setup, runs after this module loads */
  },
};

const plugin: IPlugin = {
  name: "example-plugin",
  version: "1.0.0",
  register: (container) => container.registerValue("example-service", { ping: () => "pong" }),
};

const kernel = buildKernel({ modules: [module], plugins: [plugin] });
await kernel.start();
```

## Testing

165 tests, ≥95% statement/line/function coverage and ≥90% branch coverage on every file containing executable logic (pure type-only files and barrel `index.ts` re-exports are excluded from the coverage count — see `vitest.config.ts`'s documented exclusion list). Run `pnpm test`, `pnpm test:coverage`, `pnpm lint`, `pnpm build`, `pnpm typecheck`.

## Known Limitations & Recommendation for 005.3

See `docs/005.2-CORE-RUNTIME-KERNEL-REPORT.md` for the full list, including the explicit readiness checklist for Engineering Task 005.3 (Registry System) — **not implemented in this package**.
