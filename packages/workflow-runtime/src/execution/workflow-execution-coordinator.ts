import { InstanceNotFoundException } from "../errors/instance-not-found-exception.js";
import type { ExecutionToken } from "../instance/execution-token.js";
import type { WorkflowExecution } from "../instance/workflow-execution.js";

/**
 * "Setiap Workflow Instance mempunyai token unik... pause/resume/cancel/replay cukup
 * menggunakan token. Tidak perlu mencari berdasarkan state." (user, 005.6B additional
 * improvements). The single in-memory `Map<ExecutionToken, WorkflowExecution>` every
 * imperative Runtime operation looks a live Instance up through — never a linear scan
 * filtered by state.
 */
export class WorkflowExecutionCoordinator {
  private readonly executionsByToken = new Map<ExecutionToken, WorkflowExecution>();

  register(execution: WorkflowExecution): WorkflowExecution {
    this.executionsByToken.set(execution.instance.token, execution);
    return execution;
  }

  get(token: ExecutionToken): WorkflowExecution | undefined {
    return this.executionsByToken.get(token);
  }

  require(token: ExecutionToken): WorkflowExecution {
    const execution = this.executionsByToken.get(token);
    if (!execution) {
      throw new InstanceNotFoundException(
        `No Workflow Instance is registered for ExecutionToken "${token}"`,
      );
    }
    return execution;
  }

  update(execution: WorkflowExecution): WorkflowExecution {
    this.require(execution.instance.token);
    this.executionsByToken.set(execution.instance.token, execution);
    return execution;
  }

  remove(token: ExecutionToken): void {
    this.executionsByToken.delete(token);
  }

  list(tenantId?: string): readonly WorkflowExecution[] {
    const all = Array.from(this.executionsByToken.values());
    return tenantId === undefined
      ? all
      : all.filter((execution) => execution.instance.tenantId === tenantId);
  }
}
