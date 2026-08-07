export interface KnowledgeUpdateSnapshotProps {
  readonly id: string;
  readonly takenAt: number;
  readonly pendingJobCount: number;
  readonly completedJobCount: number;
  readonly cancelledJobCount: number;
  readonly expiredJobCount: number;
  readonly queueSize: number;
}

/** Immutable point-in-time snapshot of manager/scheduler/statistics state. */
export class KnowledgeUpdateSnapshot {
  readonly id: string;
  readonly takenAt: number;
  readonly pendingJobCount: number;
  readonly completedJobCount: number;
  readonly cancelledJobCount: number;
  readonly expiredJobCount: number;
  readonly queueSize: number;

  constructor(props: KnowledgeUpdateSnapshotProps) {
    this.id = props.id;
    this.takenAt = props.takenAt;
    this.pendingJobCount = props.pendingJobCount;
    this.completedJobCount = props.completedJobCount;
    this.cancelledJobCount = props.cancelledJobCount;
    this.expiredJobCount = props.expiredJobCount;
    this.queueSize = props.queueSize;
    Object.freeze(this);
  }
}
