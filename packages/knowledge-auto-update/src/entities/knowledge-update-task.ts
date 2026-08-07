import type { Metadata } from "../types/common.js";
import type { KnowledgeUpdateType } from "../types/update-type.js";

export interface KnowledgeUpdateTaskProps {
  readonly id: string;
  readonly jobId: string;
  readonly sessionId: string;
  readonly updateType: KnowledgeUpdateType;
  readonly targetId: string;
  readonly payload: Metadata;
  readonly previousPayload: Metadata | undefined;
  readonly attempt: number;
  readonly createdAt: number;
}

/** A single, immutable execution unit produced by a coordinator run for one due job. */
export class KnowledgeUpdateTask {
  readonly id: string;
  readonly jobId: string;
  readonly sessionId: string;
  readonly updateType: KnowledgeUpdateType;
  readonly targetId: string;
  readonly payload: Metadata;
  readonly previousPayload: Metadata | undefined;
  readonly attempt: number;
  readonly createdAt: number;

  constructor(props: KnowledgeUpdateTaskProps) {
    if (props.id.trim().length === 0) {
      throw new RangeError("KnowledgeUpdateTask: id must not be empty");
    }
    this.id = props.id;
    this.jobId = props.jobId;
    this.sessionId = props.sessionId;
    this.updateType = props.updateType;
    this.targetId = props.targetId;
    this.payload = props.payload;
    this.previousPayload = props.previousPayload;
    this.attempt = props.attempt;
    this.createdAt = props.createdAt;
    Object.freeze(this);
  }
}
