import { none, some, type Option } from "@aos/common";

import type { CampaignDecision } from "../domain/entities/CampaignDecision.js";
import type { ExecutionPlan } from "../domain/entities/ExecutionPlan.js";

/**
 * In-memory, read/write store for every `ExecutionPlan` (and, by extension, every
 * `CampaignDecision`) produced across a `SamanthaAgentService`'s optimization cycles — backing
 * `GetAgentStatus`'s "current state + pending decisions" query.
 */
export class DecisionRegistry {
  private readonly plans = new Map<string, ExecutionPlan>();

  savePlan(plan: ExecutionPlan): void {
    this.plans.set(plan.id.toString(), plan);
  }

  getPlan(id: string): Option<ExecutionPlan> {
    const found = this.plans.get(id);
    return found ? some(found) : none;
  }

  listPlansByTenant(tenantId: string): ReadonlyArray<ExecutionPlan> {
    return [...this.plans.values()].filter((plan) => plan.tenantId === tenantId);
  }

  findDecision(decisionId: string): Option<CampaignDecision> {
    for (const plan of this.plans.values()) {
      const found = plan.decisions.find((decision) => decision.id.toString() === decisionId);
      if (found) {
        return some(found);
      }
    }
    return none;
  }
}
