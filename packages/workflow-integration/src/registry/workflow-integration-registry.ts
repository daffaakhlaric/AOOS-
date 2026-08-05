import type { IIntegrationAdapter } from "../adapter/i-integration-adapter.js";
import type { IntegrationNamespace } from "../contracts/integration-namespace.js";
import { AdapterAlreadyRegisteredException } from "../errors/adapter-already-registered-exception.js";
import { AdapterNotFoundException } from "../errors/adapter-not-found-exception.js";

import type { AdapterRegistration } from "./adapter-registration.js";

export interface ResolveAdapterOptions {
  readonly name?: string;
  readonly version?: string;
  readonly requireAvailable?: boolean;
}

/**
 * "INTEGRATION REGISTRY: Register, Resolve, Replace, Remove, Version, Health, Priority,
 * Namespace." (docs/PROMPT-005.6E-WORKFLOW-INTEGRATION.md). An in-memory
 * `Map<IntegrationNamespace, AdapterRegistration[]>`, keyed by namespace, ordered by
 * `priority` (highest first) within each namespace.
 */
export class WorkflowIntegrationRegistry {
  private readonly registrationsByNamespace = new Map<
    IntegrationNamespace,
    AdapterRegistration[]
  >();

  register(adapter: IIntegrationAdapter): void {
    const existing = this.registrationsByNamespace.get(adapter.namespace) ?? [];
    if (
      existing.some(
        (registration) =>
          registration.adapter.name === adapter.name &&
          registration.adapter.version === adapter.version,
      )
    ) {
      throw new AdapterAlreadyRegisteredException(
        `Adapter "${adapter.name}@${adapter.version}" is already registered for namespace "${adapter.namespace}" — use replace() instead`,
      );
    }
    const next = [...existing, { adapter, registeredAt: new Date().toISOString() }];
    next.sort((a, b) => b.adapter.priority - a.adapter.priority);
    this.registrationsByNamespace.set(adapter.namespace, next);
  }

  /** Registers `adapter`, first removing any existing registration with the same namespace + name + version. */
  replace(adapter: IIntegrationAdapter): void {
    this.remove(adapter.namespace, adapter.name, adapter.version);
    this.register(adapter);
  }

  /** Removes every registration matching `namespace`/`name`, optionally narrowed to one `version` — returns whether anything was removed. */
  remove(namespace: IntegrationNamespace, name: string, version?: string): boolean {
    const existing = this.registrationsByNamespace.get(namespace);
    if (!existing) {
      return false;
    }
    const remaining = existing.filter(
      (registration) =>
        !(
          registration.adapter.name === name &&
          (version === undefined || registration.adapter.version === version)
        ),
    );
    const removed = remaining.length !== existing.length;
    if (removed) {
      this.registrationsByNamespace.set(namespace, remaining);
    }
    return removed;
  }

  /** Resolves the highest-priority (optionally name/version-filtered) Adapter registered for `namespace` — throws `AdapterNotFoundException` if none match. */
  resolve(
    namespace: IntegrationNamespace,
    options: ResolveAdapterOptions = {},
  ): IIntegrationAdapter {
    const candidates = (this.registrationsByNamespace.get(namespace) ?? [])
      .map((registration) => registration.adapter)
      .filter((adapter) => options.name === undefined || adapter.name === options.name)
      .filter((adapter) => options.version === undefined || adapter.version === options.version)
      .filter((adapter) => !options.requireAvailable || adapter.isAvailable());

    const resolved = candidates[0];
    if (!resolved) {
      throw new AdapterNotFoundException(
        `No Adapter is registered for namespace "${namespace}"${options.name ? ` matching name "${options.name}"` : ""}`,
      );
    }
    return resolved;
  }

  list(namespace?: IntegrationNamespace): readonly IIntegrationAdapter[] {
    if (namespace) {
      return (this.registrationsByNamespace.get(namespace) ?? []).map(
        (registration) => registration.adapter,
      );
    }
    return Array.from(this.registrationsByNamespace.values()).flatMap((registrations) =>
      registrations.map((registration) => registration.adapter),
    );
  }

  listNamespaces(): readonly IntegrationNamespace[] {
    return Array.from(this.registrationsByNamespace.keys());
  }

  registrations(namespace: IntegrationNamespace): readonly AdapterRegistration[] {
    return this.registrationsByNamespace.get(namespace) ?? [];
  }
}
