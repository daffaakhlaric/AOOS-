import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

import type { TaskId } from "../value-objects/TaskId.js";
import type { TaskStatus } from "../value-objects/TaskStatus.js";

export type GenerationKind = "video" | "image";

export interface GenerationTaskProps {
  readonly taskId: TaskId;
  readonly kind: GenerationKind;
  readonly status: TaskStatus;
  readonly createdAt: Date;
}

/** A Kie AI generation (or extend) task just after creation — before/while it is being polled. */
export class GenerationTask {
  private constructor(private readonly props: GenerationTaskProps) {}

  static create(props: GenerationTaskProps): Result<GenerationTask, ValidationError> {
    if (props.kind !== "video" && props.kind !== "image") {
      return err(
        new ValidationError(
          `GenerationTask.kind must be "video" or "image", received: ${String(props.kind)}`,
        ),
      );
    }
    return ok(new GenerationTask(props));
  }

  get taskId(): TaskId {
    return this.props.taskId;
  }

  get kind(): GenerationKind {
    return this.props.kind;
  }

  get status(): TaskStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  /** Returns a new `GenerationTask` with the given status — this entity is immutable (Constitution §2.8). */
  withStatus(status: TaskStatus): GenerationTask {
    return new GenerationTask({ ...this.props, status });
  }
}
