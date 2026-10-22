import type { ActionExecutionPorts } from "./action-executor.service.js";
import type { ActionRepository, StepRow } from "./action.repository.js";
import type { ActionCommand } from "./action.types.js";

export interface ReconciliationReader {
  /** Exact deterministic external reference, scoped to account. Names alone are not proof. */
  findCandidates(command: ActionCommand, step: StepRow): Promise<readonly string[]>;
}

/** Read-only provider reconciliation. Unknown/missing evidence never grants permission to replay. */
export class ActionReconciliationService {
  constructor(
    private readonly repository: ActionRepository,
    private readonly provider: Pick<ActionExecutionPorts, "verify" | "verifyHierarchy">,
    private readonly reader: ReconciliationReader,
  ) {}

  async reconcile(tenant: string, id: string): Promise<"VERIFIED" | "PARTIAL" | "UNCERTAIN"> {
    const row = await this.repository.find(tenant, id);
    if (!row || row.command.tenantId !== tenant) throw new Error("ACTION_NOT_FOUND");
    if (!row.claim_token || !["UNCERTAIN", "PARTIAL"].includes(row.state))
      throw new Error("ACTION_NOT_RECONCILABLE");
    const token = row.claim_token;
    // CAS prevents two reconcilers from updating the same execution concurrently.
    await this.repository.transition(tenant, id, token, row.state, "RECONCILING");
    let outcome: "VERIFIED" | "PARTIAL" | "UNCERTAIN" = "UNCERTAIN";
    try {
      const steps = await this.repository.steps(tenant, id);
      let ambiguous = false;
      for (const step of steps) {
        if (["PENDING", "FAILED", "VERIFIED"].includes(step.state)) continue;
        const candidates = step.provider_object_id
          ? [step.provider_object_id]
          : await this.reader.findCandidates(row.command, step);
        if (candidates.length !== 1) {
          ambiguous = true;
          continue;
        }
        const providerId = candidates[0]!;
        const check = await this.provider.verify(row.command, step, providerId);
        if (!check.matches) {
          ambiguous = true;
          continue;
        }
        await this.repository.finishStep(step, step.state, "VERIFIED", {
          provider_object_id: providerId,
          verification: check.evidence,
        });
      }
      const current = await this.repository.steps(tenant, id);
      if (!ambiguous && current.length > 0 && current.every((s) => s.state === "VERIFIED")) {
        outcome = (await this.provider.verifyHierarchy(row.command, current))
          ? "VERIFIED"
          : "PARTIAL";
      } else if (!ambiguous && current.some((s) => s.state === "VERIFIED")) outcome = "PARTIAL";
    } catch {
      outcome = "UNCERTAIN";
    }
    await this.repository.transition(tenant, id, token, "RECONCILING", outcome);
    return outcome;
  }
}
