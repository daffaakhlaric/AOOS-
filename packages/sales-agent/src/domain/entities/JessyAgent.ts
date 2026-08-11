import type { BranchId } from "../value-objects/BranchId.js";

export interface JessyAgentProps {
  readonly name: "Jessy";
  readonly branchId: BranchId;
  readonly tenantId: string;
}

/**
 * The agent itself — Jessy's identity scoped to one branch (spec persona: "Per-branch awareness —
 * Jessy knows which branch she represents"). A thin, stateless identity value (Agent Standards
 * §11.4: agents hold no in-process state across invocations) that `JessyAgentService` threads
 * through every use case so responses/handoffs are always branch-aware.
 */
export class JessyAgent {
  private constructor(private readonly props: JessyAgentProps) {}

  static create(branchId: BranchId, tenantId: string): JessyAgent {
    return new JessyAgent({ name: "Jessy", branchId, tenantId });
  }

  get name(): "Jessy" {
    return this.props.name;
  }

  get branchId(): BranchId {
    return this.props.branchId;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }
}
