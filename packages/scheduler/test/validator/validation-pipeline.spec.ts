import { describe, expect, it } from "vitest";

import { ScheduleType } from "../../src/contracts/schedule-type.js";
import { ValidationPipeline } from "../../src/validator/validation-pipeline.js";
import { createJobInputFixture } from "../helpers/create-job-input-fixture.js";

describe("Validation Test — ValidationPipeline", () => {
  it("passes a fully valid job through every stage", () => {
    const pipeline = new ValidationPipeline();
    expect(pipeline.run(createJobInputFixture(), {}).valid).toBe(true);
  });

  it("aggregates issues from multiple stages without short-circuiting", () => {
    const input = createJobInputFixture({
      schedule: { type: ScheduleType.CRON, timezone: "Not/A_Timezone", expression: "bad" },
      tenantId: "t-2",
    });
    const pipeline = new ValidationPipeline();
    const result = pipeline.run(input, { allowedTenantIds: new Set(["t-1"]) });
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("accepts extra validators appended after the built-in stages", () => {
    const pipeline = new ValidationPipeline([
      {
        name: "custom",
        validate: () => ({ valid: false, issues: [{ path: "custom", message: "always fails" }] }),
      },
    ]);
    const result = pipeline.run(createJobInputFixture(), {});
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "custom")).toBe(true);
  });
});
