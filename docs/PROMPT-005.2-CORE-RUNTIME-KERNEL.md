# PROMPT 005.2 — Core Runtime Kernel

> Archived source prompt for `packages/runtime-kernel`. Kept for traceability of why the Kernel is structured the way it is.

## ROLE

Distinguished Software Engineer, Principal Runtime Engineer, Principal Platform Engineer, Staff Software Engineer, NestJS Architect, TypeScript Architect, Distributed Systems Engineer, Event Driven Architect, AI Runtime Engineer — building the **AOS Runtime Kernel**, not a business application.

## MANDATORY READING

All of `docs/001` through `docs/004A`, every Contract, every Schema, every Validation Rule.

## OBJECTIVE

Implement the Runtime Kernel — the foundation every future AI Agent will run on. No Agent, no Workflow, no Tool, no Dashboard.

## TARGET CAPABILITIES

Bootstrap, Lifecycle Management, Dependency Injection, Module Loading, Plugin Loading, Configuration Loading, Health Check, Shutdown, Restart, Signal Handling, Service Discovery, Capability Discovery, Version Check, Runtime/Execution/Tenant/Request/Correlation Context, Cancellation Token, Kernel Event, Kernel Metrics, Kernel Registry, Kernel Diagnostics, Kernel State Machine, Kernel Hooks.

## ARCHITECTURE

Hexagonal Architecture, Dependency Injection, Interface First, Contract First, no coupling.

## PACKAGE

`packages/runtime-kernel`, with `src/{kernel,bootstrap,lifecycle,context,container,hooks,health,diagnostics,capabilities,version,shutdown,startup,events,metrics,contracts,interfaces,types,errors,utils}/` and `test/`.

## KERNEL STATE MACHINE

`Created → Booting → LoadingConfiguration → LoadingModules → LoadingPlugins → Ready → Running → Stopping → Stopped → Restarting → Failed`.

## API SURFACE

`Kernel.start()/stop()/restart()/dispose()/reload()`; Service Container `register()/resolve()/singleton()/scoped()/transient()` with token-based resolution, lazy resolution, circular dependency detection; Module Loader and Plugin Loader as interfaces/mechanics only (no real Module/Plugin content); typed Configuration with environment, validation, reload, override, and a Secret Provider interface; full Context set; Lifecycle hooks (`OnBootstrap/OnReady/OnRunning/OnStopping/OnShutdown/OnDispose`); Hook system (`BeforeStart/AfterStart/BeforeStop/AfterStop/BeforeReload/AfterReload`); Health system (kernel/memory/CPU/dependency, readiness/liveness); Diagnostics; Kernel Events (`KernelStarted/KernelStopped/KernelFailed/KernelReloaded/ConfigurationReloaded/ModuleLoaded/PluginLoaded/HealthChanged`); Kernel Metrics; Kernel-specific error hierarchy (`KernelException/ConfigurationException/BootstrapException/ModuleException/LifecycleException/DependencyException`).

## FORBIDDEN

Workflow Engine, Registry, Scheduler, Planner, Reasoner, Reflection, Memory Engine, Event Bus, AI Gateway, Tool SDK, business logic, Dashboard, API, dealer-specific or Mitsubishi-specific code.

## VERIFICATION

`pnpm install`, `pnpm lint`, `pnpm build`, `pnpm test` must all succeed. Minimum 95% coverage. No document is changed to resolve a conflict — a new ADR is written instead if truly needed.

## DEFINITION OF DONE (binding from this task forward)

A sprint/task is done only if: all unit tests pass; lint and build are clean; no critical TODO/FIXME remains; package documentation is updated; architecture diagrams are regenerated if changed; every new dependency has a documented reason.

## DELIVERABLE

Real, complete implementation — no pseudocode, no illustrative snippets. A closing report: files created, dependency graph, class diagram, package diagram, state machine diagram, bootstrap sequence diagram, test coverage, known limitations, technical debt, and a readiness checklist for Engineering Task 005.3 (Registry System) — **not implemented here**.
