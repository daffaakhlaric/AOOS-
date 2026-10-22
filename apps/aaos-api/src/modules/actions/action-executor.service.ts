import type { ActionRepository, StepRow } from "./action.repository.js";
import { assertStepPlan, commandHash } from "./action.repository.js";
import type { ActionCommand, ActionState } from "./action.types.js";

export interface ActionExecutionPorts {
  /** Must reload current membership, integration/version, readiness, policy and provider before-state. */
  revalidate(command: ActionCommand): Promise<void>;
  /** Must use canonical MetaApiClient with executor authorization and durable receipt callback. */
  submit(
    command: ActionCommand,
    step: StepRow,
  ): Promise<{ id: string; receipt: Record<string, unknown> }>;
  verify(
    command: ActionCommand,
    step: StepRow,
    id: string,
  ): Promise<{ matches: boolean; evidence: Record<string, unknown> }>;
  verifyHierarchy(command: ActionCommand, steps: readonly StepRow[]): Promise<boolean>;
}

/** Deterministic execution core. Production binding is intentionally fail-closed until adapters are installed. */
export class ActionExecutor {
  constructor(
    private readonly repository: ActionRepository,
    private readonly ports: ActionExecutionPorts,
  ) {}

  async execute(tenant: string, id: string): Promise<ActionState> {
    const row = await this.repository.find(tenant, id);
    if (!row || row.command.tenantId !== tenant) throw new Error("ACTION_NOT_FOUND");
    if (row.state === "VERIFIED") return row.state;
    if (row.command_hash !== commandHash(row.command) || row.approval_hash !== row.command_hash)
      throw new Error("APPROVAL_MISMATCH");
    assertStepPlan(row.command, await this.repository.steps(tenant, id));
    await this.ports.revalidate(row.command);
    const token = await this.repository.claim(tenant, id);
    if (!token) throw new Error("ACTION_ALREADY_CLAIMED");
    let state: ActionState = "CLAIMED";
    let submitted = false;
    const transition = async (next: ActionState, code?: string) => {
      await this.repository.transition(tenant, id, token, state, next, code);
      state = next;
    };
    try {
      await this.ports.revalidate(row.command);
      const steps = await this.repository.steps(tenant, id);
      if (!steps.length) throw new Error("EMPTY_EXECUTION_PLAN");
      await transition("EXECUTING");
      for (const step of steps) {
        if (step.state === "VERIFIED") continue;
        if (step.state !== "PENDING") {
          await transition("UNCERTAIN", "RECONCILIATION_REQUIRED");
          return state;
        }
        await this.ports.revalidate(row.command);
        if (!(await this.repository.beginStep(step))) throw new Error("STEP_ALREADY_CLAIMED");
        submitted = true; // Set BEFORE I/O: a crash or timeout may have accepted the write.
        const receipt = await this.ports.submit(row.command, step);
        if (!receipt.id) throw new Error("MISSING_PROVIDER_ID");
        await this.repository.finishStep(step, "SUBMITTING", "VERIFYING", {
          provider_object_id: receipt.id,
          receipt: receipt.receipt,
        });
        const checked = await this.ports.verify(row.command, step, receipt.id);
        if (!checked.matches) {
          await this.repository.finishStep(step, "VERIFYING", "UNCERTAIN", {
            verification: checked.evidence,
          });
          await transition("UNCERTAIN", "READ_BACK_MISMATCH");
          return state;
        }
        await this.repository.finishStep(step, "VERIFYING", "VERIFIED", {
          verification: checked.evidence,
        });
        submitted = false;
      }
      await transition("VERIFYING");
      const persisted = await this.repository.steps(tenant, id);
      if (
        !persisted.every((s) => s.state === "VERIFIED") ||
        !(await this.ports.verifyHierarchy(row.command, persisted))
      ) {
        await transition("PARTIAL", "HIERARCHY_NOT_VERIFIED");
      } else await transition("VERIFIED");
      return state;
    } catch {
      // Never classify an unknown provider result as safely retryable.
      const steps = await this.repository.steps(tenant, id).catch(() => null);
      const uncertain =
        submitted ||
        steps === null ||
        steps.some((s) => ["SUBMITTING", "VERIFYING", "UNCERTAIN"].includes(s.state));
      const next = uncertain
        ? "UNCERTAIN"
        : steps.some((s) => s.state === "VERIFIED")
          ? "PARTIAL"
          : "FAILED";
      await transition(next, uncertain ? "RECONCILIATION_REQUIRED" : "EXECUTION_BLOCKED");
      return state;
    }
  }
}
