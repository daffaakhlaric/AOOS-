import { describe, expect, it } from "vitest";

import { SynchronizationUpdateStrategy } from "../../src/strategies/synchronization-update-strategy.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { makeTask } from "../helpers/pipeline-helpers.js";

describe("SynchronizationUpdateStrategy", () => {
  it("declares updateType Synchronization", () => {
    expect(new SynchronizationUpdateStrategy().updateType).toBe(
      KnowledgeUpdateType.Synchronization,
    );
  });

  it("stamps synchronizedAt with the given now", () => {
    const task = makeTask({ payload: { a: 1 } });
    const result = new SynchronizationUpdateStrategy().execute({ task, now: 777 });
    expect(result.appliedPayload).toEqual({ a: 1, synchronizedAt: 777 });
  });

  it("reports success = true", () => {
    const task = makeTask({ payload: {} });
    const result = new SynchronizationUpdateStrategy().execute({ task, now: 0 });
    expect(result.success).toBe(true);
  });
});
