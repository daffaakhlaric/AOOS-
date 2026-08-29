import type { BranchId } from "../value-objects/BranchId.js";

export interface ClaraAgentProps {
  readonly name: "Clara";
  readonly branchId: BranchId;
  readonly tenantId: string;
}

/**
 * The agent itself — Clara's identity scoped to one branch (spec persona: "Per-branch awareness —
 * Clara knows which branch she represents"). A thin, stateless identity value (Agent Standards
 * §11.4: agents hold no in-process state across invocations) that `ClaraAgentService` threads
 * through every use case so responses/handoffs are always branch-aware.
 */
export class ClaraAgent {
  private constructor(private readonly props: ClaraAgentProps) {}

  static create(branchId: BranchId, tenantId: string): ClaraAgent {
    return new ClaraAgent({ name: "Clara", branchId, tenantId });
  }

  get name(): "Clara" {
    return this.props.name;
  }

  get branchId(): BranchId {
    return this.props.branchId;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }
}
