import { none, some, type Option } from "@aos/common";

import type { TamaraAgent } from "../domain/entities/TamaraAgent.js";

/**
 * In-memory, read/write store for `TamaraAgent` instances, keyed by id — one per
 * `TamaraAgentFactory.create()` call's composed `TamaraAgentService`. Mirrors
 * `@aos/objective-engine`'s `ObjectiveRegistry` / `@aos/meta-ads-connector`'s `AdAccountRegistry`
 * convention: a thin, package-internal store, no database, no persistence.
 */
export class AgentRegistry {
  private readonly agents = new Map<string, TamaraAgent>();

  save(agent: TamaraAgent): void {
    this.agents.set(agent.id, agent);
  }

  get(id: string): Option<TamaraAgent> {
    const found = this.agents.get(id);
    return found ? some(found) : none;
  }

  listByTenant(tenantId: string): ReadonlyArray<TamaraAgent> {
    return [...this.agents.values()].filter((agent) => agent.tenantId === tenantId);
  }
}
