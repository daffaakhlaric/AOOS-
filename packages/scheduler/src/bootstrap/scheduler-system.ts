import type { IPublisher } from "@aos/event-bus";
import type { IModule } from "@aos/runtime-kernel";

import type { SchedulerConfig } from "../config/scheduler-config.js";
import { SchedulerEventPublisher } from "../events/scheduler-event-publisher.js";
import { Scheduler } from "../scheduler/scheduler.js";

/**
 * The Scheduler System — composition root wrapping `Scheduler` as a Kernel Module,
 * mirroring `@aos/event-bus`'s `EventBusSystem` and `@aos/registry`'s `RegistrySystem`.
 * Implements `@aos/runtime-kernel`'s `IModule` so it can be registered into a Kernel via
 * `buildKernel({ modules: [schedulerSystem] })` — not yet wired into any actual Kernel
 * bootstrap call (no application does that in this Engineering Task). Requires a live
 * `@aos/event-bus` `IPublisher` — "Scheduler hanya menerbitkan Event," so it never
 * constructs its own Event Bus.
 */
export class SchedulerSystem implements IModule {
  readonly name = "SchedulerSystemModule";
  readonly version = "0.1.0";
  readonly scheduler: Scheduler;

  constructor(publisher: IPublisher, config: SchedulerConfig = {}) {
    this.scheduler = new Scheduler({
      eventPublisher: new SchedulerEventPublisher(publisher),
      store: config.store,
      clock: config.clock,
      lockProvider: config.lockProvider,
      policies: config.policies,
      lockTtlMs: config.lockTtlMs,
      validationContext: config.allowedTenantIds
        ? { allowedTenantIds: new Set(config.allowedTenantIds) }
        : undefined,
    });
  }

  async onBootstrap(): Promise<void> {
    // Nothing to do — the Scheduler is already constructed and ready to accept createJob()/tick() calls.
  }

  async onShutdown(): Promise<void> {
    // No background loop or open resource to release — tick() is caller-driven, per module docstring.
  }
}
