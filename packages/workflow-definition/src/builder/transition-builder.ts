import type { TransitionKind } from "../contracts/transition-kind.js";
import { BuilderException } from "../errors/builder-exception.js";
import type { Expression } from "../expressions/expression.js";
import { transitionSchema, type Transition } from "../transitions/transition.js";

/** TransitionBuilder — fluent construction of a single `Transition`. */
export class TransitionBuilder {
  private fields: Partial<Transition>;

  private constructor(id: string, kind: TransitionKind, fromNodeId: string, toNodeId: string) {
    this.fields = { id, kind, fromNodeId, toNodeId };
  }

  static create(
    id: string,
    kind: TransitionKind,
    fromNodeId: string,
    toNodeId: string,
  ): TransitionBuilder {
    return new TransitionBuilder(id, kind, fromNodeId, toNodeId);
  }

  withCondition(condition: Expression): this {
    this.fields = { ...this.fields, condition };
    return this;
  }

  withPriority(priority: number): this {
    this.fields = { ...this.fields, priority };
    return this;
  }

  withDescription(description: string): this {
    this.fields = { ...this.fields, description };
    return this;
  }

  build(): Transition {
    const result = transitionSchema.safeParse(this.fields);
    if (!result.success) {
      throw new BuilderException(
        `Failed to build Transition: ${result.error.issues.map((i) => i.message).join("; ")}`,
      );
    }
    return result.data;
  }
}
