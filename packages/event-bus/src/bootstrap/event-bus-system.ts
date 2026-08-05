import type { IModule } from "@aos/runtime-kernel";

import { EventBroker, type EventBrokerOptions } from "../broker/event-broker.js";
import type { EventBusConfig } from "../config/event-bus-config.js";

function toBrokerOptions(config: EventBusConfig): EventBrokerOptions {
  return {
    defaultRetryPolicy: config.defaultRetryPolicy,
    validationContext: {
      allowedTenantIds: config.allowedTenantIds ? new Set(config.allowedTenantIds) : undefined,
      supportedSchemaVersionRange: config.supportedSchemaVersionRange,
    },
  };
}

/**
 * The Event Bus System — composition root wrapping `EventBroker` as a Kernel Module, mirroring
 * `@aos/registry`'s `RegistrySystem`. Implements `@aos/runtime-kernel`'s `IModule` so it can be
 * registered into a Kernel via `buildKernel({ modules: [eventBusSystem] })` — not yet wired
 * into any actual Kernel bootstrap call (no application does that in this Engineering Task).
 */
export class EventBusSystem implements IModule {
  readonly name = "EventBusSystemModule";
  readonly version = "0.1.0";
  readonly broker: EventBroker;

  constructor(config: EventBusConfig = {}) {
    this.broker = new EventBroker(toBrokerOptions(config));
  }

  async onBootstrap(): Promise<void> {
    // Nothing to do — the Broker is already constructed and ready to accept publish()/subscribe() calls.
  }

  async onShutdown(): Promise<void> {
    this.broker.events.removeAllListeners();
  }
}
