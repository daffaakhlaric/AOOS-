import { NodeState } from "../contracts/node-state.js";
import { NodeValidationException } from "../errors/node-validation-exception.js";
import type { NodeExecution } from "../instance/node-execution.js";
import type { ValidationPipeline } from "../validator/validation-pipeline.js";

import type { INodeLifecycleManager } from "./i-node-lifecycle-manager.js";
import type { INodeStateMachine } from "./i-node-state-machine.js";

/**
 * The named Lifecycle operations (docs/PROMPT-005.6C-ENTERPRISE-NODE-RUNTIME.md —
 * "NODE LIFECYCLE") — `initialize`/`start`/`pause`/`resume`/`complete`/`fail`/`cancel`/
 * `timeout` wrap the State Machine and stamp `startedAt`/`completedAt`; `validate()` runs
 * the `ValidationPipeline` without changing state; `prepare()` is a pass-through
 * extension hook. `compensate()` is deliberately NOT implemented here — see
 * `INodeCompensatable`.
 */
export class NodeLifecycleManager implements INodeLifecycleManager {
  constructor(
    private readonly stateMachine: INodeStateMachine,
    private readonly validationPipeline: ValidationPipeline,
  ) {}

  initialize(execution: NodeExecution): NodeExecution {
    return this.stateMachine.transition({ execution, to: NodeState.READY });
  }

  validate(execution: NodeExecution): NodeExecution {
    const result = this.validationPipeline.run(execution);
    if (!result.valid) {
      throw new NodeValidationException(
        `Node Instance "${execution.instance.id}" failed validation: ${result.issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    return execution;
  }

  prepare(execution: NodeExecution): NodeExecution {
    return execution;
  }

  start(execution: NodeExecution): NodeExecution {
    const transitioned = this.stateMachine.transition({ execution, to: NodeState.RUNNING });
    const startedAt = transitioned.instance.startedAt ?? new Date().toISOString();
    return { ...transitioned, instance: { ...transitioned.instance, startedAt } };
  }

  pause(execution: NodeExecution, reason?: string): NodeExecution {
    return this.stateMachine.transition({ execution, to: NodeState.PAUSED, reason });
  }

  resume(execution: NodeExecution): NodeExecution {
    return this.stateMachine.transition({ execution, to: NodeState.RUNNING });
  }

  complete(execution: NodeExecution): NodeExecution {
    return this.stampCompleted(
      this.stateMachine.transition({ execution, to: NodeState.COMPLETED }),
    );
  }

  fail(execution: NodeExecution, reason?: string): NodeExecution {
    return this.stampCompleted(
      this.stateMachine.transition({ execution, to: NodeState.FAILED, reason }),
    );
  }

  cancel(execution: NodeExecution, reason?: string): NodeExecution {
    return this.stampCompleted(
      this.stateMachine.transition({ execution, to: NodeState.CANCELLED, reason }),
    );
  }

  timeout(execution: NodeExecution): NodeExecution {
    return this.stampCompleted(
      this.stateMachine.transition({ execution, to: NodeState.TIMED_OUT }),
    );
  }

  private stampCompleted(execution: NodeExecution): NodeExecution {
    return {
      ...execution,
      instance: { ...execution.instance, completedAt: new Date().toISOString() },
    };
  }
}
