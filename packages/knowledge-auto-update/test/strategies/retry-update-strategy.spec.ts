import { describe, expect, it } from "vitest";

import { RetryUpdateStrategy } from "../../src/strategies/retry-update-strategy.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { makeTask } from "../helpers/pipeline-helpers.js";

describe("RetryUpdateStrategy", () => {
  it("declares updateType Retry", () => {
    expect(new RetryUpdateStrategy().updateType).toBe(KnowledgeUpdateType.Retry);
  });

  it("tags the applied payload with the task's attempt number", () => {
    const task = makeTask({ payload: { a: 1 }, attempt: 2 });
    const result = new RetryUpdateStrategy().execute({ task, now: 0 });
    expect(result.appliedPayload).toEqual({ a: 1, retryAttempt: 2 });
  });

  it("uses attempt 0 for a task that has never retried", () => {
    const task = makeTask({ payload: {}, attempt: 0 });
    const result = new RetryUpdateStrategy().execute({ task, now: 0 });
    expect(result.appliedPayload).toEqual({ retryAttempt: 0 });
  });
});
