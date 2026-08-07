import { describe, expect, it } from "vitest";

import { EmergencyUpdateStrategy } from "../../src/strategies/emergency-update-strategy.js";
import { KnowledgeUpdateType } from "../../src/types/update-type.js";
import { makeTask } from "../helpers/pipeline-helpers.js";

describe("EmergencyUpdateStrategy", () => {
  it("declares updateType Emergency", () => {
    expect(new EmergencyUpdateStrategy().updateType).toBe(KnowledgeUpdateType.Emergency);
  });

  it("tags the applied payload as emergency", () => {
    const task = makeTask({ payload: { a: 1 } });
    const result = new EmergencyUpdateStrategy().execute({ task, now: 0 });
    expect(result.appliedPayload).toEqual({ a: 1, emergency: true });
  });

  it("overrides a pre-existing emergency field in the payload with true", () => {
    const task = makeTask({ payload: { emergency: false } });
    const result = new EmergencyUpdateStrategy().execute({ task, now: 0 });
    expect(result.appliedPayload).toEqual({ emergency: true });
  });
});
