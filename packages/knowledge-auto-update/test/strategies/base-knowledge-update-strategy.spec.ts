import { describe, expect, it } from "vitest";

import type { KnowledgeUpdateTask } from "../../src/entities/knowledge-update-task.js";
import { BaseKnowledgeUpdateStrategy } from "../../src/strategies/base-knowledge-update-strategy.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { makeTask } from "../helpers/pipeline-helpers.js";

class ThrowingStrategy extends BaseKnowledgeUpdateStrategy {
  readonly updateType = KnowledgeUpdateType.Manual;
  protected computeAppliedPayload(): never {
    throw new Error("computation failed");
  }
}

class NonErrorThrowingStrategy extends BaseKnowledgeUpdateStrategy {
  readonly updateType = KnowledgeUpdateType.Manual;
  protected computeAppliedPayload(): never {
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw "plain string";
  }
}

class EchoStrategy extends BaseKnowledgeUpdateStrategy {
  readonly updateType = KnowledgeUpdateType.Manual;
  protected computeAppliedPayload(task: KnowledgeUpdateTask) {
    return task.payload;
  }
}

describe("BaseKnowledgeUpdateStrategy", () => {
  it("returns a success result when computeAppliedPayload succeeds", () => {
    const task = makeTask({ payload: { a: 1 } });
    const result = new EchoStrategy().execute({ task, now: 100 });
    expect(result.success).toBe(true);
    expect(result.appliedPayload).toEqual({ a: 1 });
    expect(result.durationMs).toBe(0);
    expect(result.completedAt).toBe(100);
  });

  it("returns a failure result when computeAppliedPayload throws an Error", () => {
    const task = makeTask();
    const result = new ThrowingStrategy().execute({ task, now: 0 });
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("computation failed");
  });

  it("stringifies a non-Error throw", () => {
    const task = makeTask();
    const result = new NonErrorThrowingStrategy().execute({ task, now: 0 });
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBe("plain string");
  });
});
