import { describe, expect, it } from "vitest";

import { JobPriority } from "../../src/contracts/job-priority.js";
import { PolicyPipeline } from "../../src/policy/policy-pipeline.js";

const context = { jobId: "job-1", priority: JobPriority.NORMAL, now: new Date() };

describe("PolicyPipeline", () => {
  it("allows when there are no policies configured", async () => {
    expect((await new PolicyPipeline().evaluate(context)).allowed).toBe(true);
  });

  it("allows when every policy allows", async () => {
    const pipeline = new PolicyPipeline([
      { name: "always-allow-1", evaluate: () => ({ allowed: true }) },
      { name: "always-allow-2", evaluate: () => ({ allowed: true }) },
    ]);
    expect((await pipeline.evaluate(context)).allowed).toBe(true);
  });

  it("stops at the first denial and prefixes the reason with the policy name", async () => {
    const second = { name: "second", evaluate: () => ({ allowed: false, reason: "denied" }) };
    let secondCalled = false;
    const pipeline = new PolicyPipeline([
      {
        name: "first",
        evaluate: () => {
          secondCalled = true;
          return { allowed: true };
        },
      },
      second,
      { name: "third", evaluate: () => ({ allowed: false, reason: "should not run" }) },
    ]);
    const decision = await pipeline.evaluate(context);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("second: denied");
    expect(secondCalled).toBe(true);
  });

  it("defaults the reason to 'denied' when a policy omits one", async () => {
    const pipeline = new PolicyPipeline([{ name: "mute", evaluate: () => ({ allowed: false }) }]);
    const decision = await pipeline.evaluate(context);
    expect(decision.reason).toBe("mute: denied");
  });

  it("supports async policies", async () => {
    const pipeline = new PolicyPipeline([
      { name: "async", evaluate: async () => ({ allowed: true }) },
    ]);
    expect((await pipeline.evaluate(context)).allowed).toBe(true);
  });
});
