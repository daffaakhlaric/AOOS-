import { describe, expect, it } from "vitest";

import { workflowIntegrationContextSchema } from "../../src/context/workflow-integration-context.js";
import { contextFixture } from "../helpers/context-fixture.js";

describe("workflowIntegrationContextSchema", () => {
  it("accepts a valid Context built via the fixture", () => {
    const context = contextFixture();
    expect(workflowIntegrationContextSchema.safeParse(context).success).toBe(true);
  });

  it("rejects a Context missing a required field", () => {
    const context = contextFixture();
    const { workflowId: _workflowId, ...rest } = context;
    expect(workflowIntegrationContextSchema.safeParse(rest).success).toBe(false);
  });

  it("accepts a populated Result slot", () => {
    const context = { ...contextFixture(), capabilityResult: { success: true, output: {} } };
    expect(workflowIntegrationContextSchema.safeParse(context).success).toBe(true);
  });

  it("rejects an invalid Result slot shape", () => {
    const context = { ...contextFixture(), capabilityResult: { success: "not-a-boolean" } };
    expect(workflowIntegrationContextSchema.safeParse(context).success).toBe(false);
  });
});
