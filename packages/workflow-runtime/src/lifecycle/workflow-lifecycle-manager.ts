import { InstanceState } from "../instance/instance-state.js";
import type { WorkflowExecution } from "../instance/workflow-execution.js";
import type { IWorkflowStateMachine } from "../state-machine/i-state-machine.js";

import type { IWorkflowLifecycleManager } from "./i-lifecycle-manager.js";

/**
 * The named Lifecycle operations (docs/PROMPT-005.6B-WORKFLOW-RUNTIME-CORE.md —
 * "LIFECYCLE") — each is a thin, named wrapper around `IWorkflowStateMachine#transition()`
 * that also stamps `startedAt`/`completedAt`. Illegal transitions surface as
 * `IllegalTransitionException` from the State Machine itself. `restart()` is
 * deliberately NOT implemented here — see `IRestartable`.
 */
export class WorkflowLifecycleManager implements IWorkflowLifecycleManager {
  constructor(private readonly stateMachine: IWorkflowStateMachine) {}

  initialize(execution: WorkflowExecution): WorkflowExecution {
    return this.stateMachine.transition({ execution, to: InstanceState.READY });
  }

  start(execution: WorkflowExecution): WorkflowExecution {
    const transitioned = this.stateMachine.transition({ execution, to: InstanceState.RUNNING });
    const startedAt = transitioned.instance.startedAt ?? new Date().toISOString();
    return { ...transitioned, instance: { ...transitioned.instance, startedAt } };
  }

  pause(execution: WorkflowExecution, reason?: string): WorkflowExecution {
    return this.stateMachine.transition({ execution, to: InstanceState.PAUSED, reason });
  }

  resume(execution: WorkflowExecution): WorkflowExecution {
    return this.stateMachine.transition({ execution, to: InstanceState.RUNNING });
  }

  cancel(execution: WorkflowExecution, reason?: string): WorkflowExecution {
    return this.stampCompleted(
      this.stateMachine.transition({ execution, to: InstanceState.CANCELLED, reason }),
    );
  }

  expire(execution: WorkflowExecution): WorkflowExecution {
    return this.stampCompleted(
      this.stateMachine.transition({ execution, to: InstanceState.EXPIRED }),
    );
  }

  complete(execution: WorkflowExecution): WorkflowExecution {
    return this.stampCompleted(
      this.stateMachine.transition({ execution, to: InstanceState.COMPLETED }),
    );
  }

  fail(execution: WorkflowExecution, reason?: string): WorkflowExecution {
    return this.stampCompleted(
      this.stateMachine.transition({ execution, to: InstanceState.FAILED, reason }),
    );
  }

  private stampCompleted(execution: WorkflowExecution): WorkflowExecution {
    return {
      ...execution,
      instance: { ...execution.instance, completedAt: new Date().toISOString() },
    };
  }
}
