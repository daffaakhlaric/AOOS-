import { describe, expect, it } from "vitest";

import { RecoveryUpdateStrategy } from "../../src/strategies/recovery-update-strategy.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { makeTask } from "../helpers/pipeline-helpers.js";

describe("RecoveryUpdateStrategy", () => {
  it("declares updateType Recovery", () => {
    expect(new RecoveryUpdateStrategy().updateType).toBe(KnowledgeUpdateType.Recovery);
  });

  it("merges payload over previousPayload and stamps recoveredAt", () => {
    const task = makeTask({ payload: { b: 2 }, previousPayload: { a: 1 } });
    const result = new RecoveryUpdateStrategy().execute({ task, now: 42 });
    expect(result.appliedPayload).toEqual({ a: 1, b: 2, recoveredAt: 42 });
  });

  it("works with no previousPayload at all", () => {
    const task = makeTask({ payload: { b: 2 } });
    const result = new RecoveryUpdateStrategy().execute({ task, now: 1 });
    expect(result.appliedPayload).toEqual({ b: 2, recoveredAt: 1 });
  });
});
