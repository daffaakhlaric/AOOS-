import type { KnowledgeRuntimeExecution } from "../domain/knowledge-runtime-execution.js";
import { KnowledgeRuntimeState } from "../domain/knowledge-runtime-state.js";
import type { IKnowledgeRuntimeStateMachine } from "../state-machine/i-state-machine.js";

import type { IKnowledgeRuntimeLifecycle } from "./i-lifecycle.js";

/**
 * "RUNTIME LIFECYCLE: Created → Loading → Loaded → Validating → Ready → Running →
 * Suspended → Resuming → Completed | Failed | Cancelled | Expired → Destroyed."
 * (docs/PROMPT-005.7B-KNOWLEDGE-RUNTIME.md) — each named operation is a thin wrapper
 * around `IKnowledgeRuntimeStateMachine#transition()` that also stamps
 * `startedAt`/`completedAt`. Illegal transitions surface as
 * `IllegalRuntimeTransitionException` from the State Machine itself.
 */
export class KnowledgeRuntimeLifecycle implements IKnowledgeRuntimeLifecycle {
  constructor(private readonly stateMachine: IKnowledgeRuntimeStateMachine) {}

  load(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution {
    return this.stateMachine.transition({ execution, to: KnowledgeRuntimeState.LOADING });
  }

  markLoaded(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution {
    return this.stateMachine.transition({ execution, to: KnowledgeRuntimeState.LOADED });
  }

  validate(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution {
    return this.stateMachine.transition({ execution, to: KnowledgeRuntimeState.VALIDATING });
  }

  markReady(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution {
    return this.stateMachine.transition({ execution, to: KnowledgeRuntimeState.READY });
  }

  start(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution {
    const transitioned = this.stateMachine.transition({
      execution,
      to: KnowledgeRuntimeState.RUNNING,
    });
    const startedAt = transitioned.instance.startedAt ?? new Date().toISOString();
    return { ...transitioned, instance: { ...transitioned.instance, startedAt } };
  }

  suspend(execution: KnowledgeRuntimeExecution, reason?: string): KnowledgeRuntimeExecution {
    return this.stateMachine.transition({ execution, to: KnowledgeRuntimeState.SUSPENDED, reason });
  }

  resume(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution {
    const transitioned = this.stateMachine.transition({
      execution,
      to: KnowledgeRuntimeState.RESUMING,
    });
    return {
      ...transitioned,
      instance: {
        ...transitioned.instance,
        statistics: {
          ...transitioned.instance.statistics,
          resumeCount: transitioned.instance.statistics.resumeCount + 1,
        },
      },
    };
  }

  markResumed(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution {
    return this.stateMachine.transition({ execution, to: KnowledgeRuntimeState.RUNNING });
  }

  complete(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution {
    return this.stampCompleted(
      this.stateMachine.transition({ execution, to: KnowledgeRuntimeState.COMPLETED }),
    );
  }

  fail(execution: KnowledgeRuntimeExecution, reason?: string): KnowledgeRuntimeExecution {
    return this.stampCompleted(
      this.stateMachine.transition({ execution, to: KnowledgeRuntimeState.FAILED, reason }),
    );
  }

  cancel(execution: KnowledgeRuntimeExecution, reason?: string): KnowledgeRuntimeExecution {
    return this.stampCompleted(
      this.stateMachine.transition({ execution, to: KnowledgeRuntimeState.CANCELLED, reason }),
    );
  }

  expire(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution {
    return this.stampCompleted(
      this.stateMachine.transition({ execution, to: KnowledgeRuntimeState.EXPIRED }),
    );
  }

  destroy(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution {
    return this.stateMachine.transition({ execution, to: KnowledgeRuntimeState.DESTROYED });
  }

  private stampCompleted(execution: KnowledgeRuntimeExecution): KnowledgeRuntimeExecution {
    return {
      ...execution,
      instance: { ...execution.instance, completedAt: new Date().toISOString() },
    };
  }
}
