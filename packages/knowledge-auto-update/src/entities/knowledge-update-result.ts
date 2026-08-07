import type { Metadata } from "../types/common.js";

export interface KnowledgeUpdateResultProps {
  readonly id: string;
  readonly taskId: string;
  readonly jobId: string;
  readonly success: boolean;
  readonly appliedPayload: Metadata | undefined;
  readonly errorMessage: string | undefined;
  readonly durationMs: number;
  readonly completedAt: number;
}

/** Immutable outcome of executing one `KnowledgeUpdateTask`. */
export class KnowledgeUpdateResult {
  readonly id: string;
  readonly taskId: string;
  readonly jobId: string;
  readonly success: boolean;
  readonly appliedPayload: Metadata | undefined;
  readonly errorMessage: string | undefined;
  readonly durationMs: number;
  readonly completedAt: number;

  constructor(props: KnowledgeUpdateResultProps) {
    if (props.durationMs < 0) {
      throw new RangeError("KnowledgeUpdateResult: durationMs must be >= 0");
    }
    this.id = props.id;
    this.taskId = props.taskId;
    this.jobId = props.jobId;
    this.success = props.success;
    this.appliedPayload = props.appliedPayload;
    this.errorMessage = props.errorMessage;
    this.durationMs = props.durationMs;
    this.completedAt = props.completedAt;
    Object.freeze(this);
  }
}
