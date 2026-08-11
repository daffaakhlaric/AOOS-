import { AgentMemory } from "../../domain/entities/AgentMemory.js";
import { TamaraAgent } from "../../domain/entities/TamaraAgent.js";
import { AgentState } from "../../domain/value-objects/AgentState.js";
import type { AgentRegistry } from "../../registry/AgentRegistry.js";
import type { DecisionRegistry } from "../../registry/DecisionRegistry.js";

/**
 * Owns Tamara's identity (`TamaraAgent`), her in-memory learning state (`AgentMemory` — reset
 * fresh here, once, at construction time by `TamaraAgentFactory.create()`, then accumulated
 * across every `RunOptimizationCycle` call made against this same instance), and the registries
 * that back `GetAgentStatus`.
 */
export class TamaraAgentService {
  private agent: TamaraAgent;
  private readonly memory = new AgentMemory();

  constructor(
    tenantId: string,
    private readonly registry: AgentRegistry,
    private readonly decisionRegistry: DecisionRegistry,
    now: () => Date = () => new Date(),
  ) {
    const created = TamaraAgent.create({
      id: crypto.randomUUID(),
      tenantId,
      name: "Tamara",
      state: AgentState.IDLE,
      createdAt: now(),
      cycleCount: 0,
    });
    /* v8 ignore next 7 */
    if (!created.ok) {
      // Unreachable: tenantId is validated by the caller's Zod schema before construction reaches
      // here, and every other TamaraAgent.create precondition is satisfied by literal constants.
      throw new Error(
        `TamaraAgentService: invariant violated constructing TamaraAgent — ${created.error.message}`,
      );
    }
    this.agent = created.value;
    this.registry.save(this.agent);
  }

  getAgent(): TamaraAgent {
    return this.agent;
  }

  getMemory(): AgentMemory {
    return this.memory;
  }

  getDecisionRegistry(): DecisionRegistry {
    return this.decisionRegistry;
  }

  transitionTo(state: AgentState): void {
    this.agent = this.agent.transitionTo(state);
    this.registry.save(this.agent);
  }

  completeCycle(at: Date): void {
    this.agent = this.agent.completeCycle(at);
    this.registry.save(this.agent);
  }
}
