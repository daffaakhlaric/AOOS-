export interface KnowledgeUpdateSessionProps {
  readonly id: string;
  readonly taskIds: readonly string[];
  readonly resultIds: readonly string[];
  readonly startedAt: number;
  readonly completedAt: number | undefined;
}

/** Groups the tasks/results produced by one coordinator `processDue` run. */
export class KnowledgeUpdateSession {
  readonly id: string;
  readonly taskIds: readonly string[];
  readonly resultIds: readonly string[];
  readonly startedAt: number;
  readonly completedAt: number | undefined;

  constructor(props: KnowledgeUpdateSessionProps) {
    this.id = props.id;
    this.taskIds = props.taskIds;
    this.resultIds = props.resultIds;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    Object.freeze(this);
    Object.freeze(this.taskIds);
    Object.freeze(this.resultIds);
  }

  withTaskId(taskId: string): KnowledgeUpdateSession {
    return new KnowledgeUpdateSession({ ...this, taskIds: [...this.taskIds, taskId] });
  }

  withResultId(resultId: string): KnowledgeUpdateSession {
    return new KnowledgeUpdateSession({ ...this, resultIds: [...this.resultIds, resultId] });
  }

  withCompletedAt(completedAt: number): KnowledgeUpdateSession {
    return new KnowledgeUpdateSession({ ...this, completedAt });
  }
}
