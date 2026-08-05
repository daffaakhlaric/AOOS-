import type { ISchedulerPolicy, PolicyContext, PolicyDecision } from "./i-scheduler-policy.js";

/** Runs every configured policy in order, stopping at the first denial (dispatch-gating semantics — unlike Validation, which aggregates every issue). */
export class PolicyPipeline {
  constructor(private readonly policies: readonly ISchedulerPolicy[] = []) {}

  async evaluate(context: PolicyContext): Promise<PolicyDecision> {
    for (const policy of this.policies) {
      const decision = await policy.evaluate(context);
      if (!decision.allowed) {
        return { allowed: false, reason: `${policy.name}: ${decision.reason ?? "denied"}` };
      }
    }
    return { allowed: true };
  }
}
