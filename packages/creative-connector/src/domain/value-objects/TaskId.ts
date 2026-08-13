import { err, ok, type Result } from "@aos/common";
import { ValidationError } from "@aos/errors";

/** A Kie AI task identifier (`data.taskId` from a generate/extend response), e.g. `"task_veo_1765178608584"`. Opaque — never parsed for structure, only round-tripped for polling. */
export class TaskId {
  private constructor(private readonly value: string) {}

  static create(raw: string): Result<TaskId, ValidationError> {
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return err(
        new ValidationError(`TaskId must be a non-empty string, received: ${JSON.stringify(raw)}`),
      );
    }
    return ok(new TaskId(raw));
  }

  toString(): string {
    return this.value;
  }

  equals(other: TaskId): boolean {
    return this.value === other.value;
  }
}
