import { none, some, type Option } from "@aos/common";

import type { SamanthaAgent } from "../domain/entities/SamanthaAgent.js";

/**
 * In-memory, read/write store for `SamanthaAgent` instances, keyed by id — one per
 * `SamanthaAgentFactory.create()` call's composed `SamanthaAgentService`. Mirrors
 * `@aos/objective-engine`'s `ObjectiveRegistry` / `@aos/meta-ads-connector`'s `AdAccountRegistry`
 * convention: a thin, package-internal store, no database, no persistence.
 */
export class AgentRegistry {
  private readonly agents = new Map<string, SamanthaAgent>();

  save(agent: SamanthaAgent): void {
    this.agents.set(agent.id, agent);
  }

  get(id: string): Option<SamanthaAgent> {
    const found = this.agents.get(id);
    return found ? some(found) : none;
  }

  listByTenant(tenantId: string): ReadonlyArray<SamanthaAgent> {
    return [...this.agents.values()].filter((agent) => agent.tenantId === tenantId);
  }
}
