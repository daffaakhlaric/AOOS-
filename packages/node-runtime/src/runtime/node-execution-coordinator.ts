import { NodeInstanceNotFoundException } from "../errors/node-instance-not-found-exception.js";
import type { NodeExecution } from "../instance/node-execution.js";

/** Internal to `runtime/` — the in-memory `Map<nodeInstanceId, NodeExecution>` every imperative Runtime operation looks a live Node Instance up through. Not part of this package's public API. */
export class NodeExecutionCoordinator {
  private readonly executionsById = new Map<string, NodeExecution>();

  register(execution: NodeExecution): NodeExecution {
    this.executionsById.set(execution.instance.id, execution);
    return execution;
  }

  get(id: string): NodeExecution | undefined {
    return this.executionsById.get(id);
  }

  require(id: string): NodeExecution {
    const execution = this.executionsById.get(id);
    if (!execution) {
      throw new NodeInstanceNotFoundException(`No Node Instance is registered for id "${id}"`);
    }
    return execution;
  }

  update(execution: NodeExecution): NodeExecution {
    this.require(execution.instance.id);
    this.executionsById.set(execution.instance.id, execution);
    return execution;
  }

  remove(id: string): void {
    this.executionsById.delete(id);
  }

  list(workflowInstanceId?: string): readonly NodeExecution[] {
    const all = Array.from(this.executionsById.values());
    return workflowInstanceId === undefined
      ? all
      : all.filter((execution) => execution.instance.workflowInstanceId === workflowInstanceId);
  }
}
