import { describe, expect, it } from "vitest";

import { buildExecutionGraph } from "../../src/graph/execution-graph.js";
import { RetryStrategy } from "../../src/retry/retry-policy.js";
import { ExecutionValidationPipeline } from "../../src/validator/execution-validation-pipeline.js";
import { brokenDefinitionFixture, definitionFixture } from "../helpers/definition-fixture.js";
import { sessionFixture } from "../helpers/session-fixture.js";

describe("Validator Test — ExecutionValidationPipeline", () => {
  it("reports valid:true for a well-formed session with no extra config", () => {
    const { session } = sessionFixture({ definition: definitionFixture() });
    const graph = buildExecutionGraph(session.definition);
    const result = new ExecutionValidationPipeline().run({ session, graph });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("aggregates issues across every validator stage without short-circuiting", () => {
    const { session } = sessionFixture({ definition: brokenDefinitionFixture() });
    const graph = buildExecutionGraph(session.definition);
    const result = new ExecutionValidationPipeline().run({
      session,
      graph,
      retryPolicy: { strategy: RetryStrategy.CUSTOM, maxAttempts: 0 },
      timeouts: { nodeTimeoutMs: -1 },
    });
    expect(result.valid).toBe(false);
    const paths = result.issues.map((issue) => issue.path);
    expect(paths.some((path) => path.startsWith("nodes"))).toBe(true);
    expect(paths).toContain("timeouts.nodeTimeoutMs");
    expect(paths).toContain("retryPolicy.maxAttempts");
    expect(paths).toContain("retryPolicy.customDelayFn");
  });

  it("runs an injected extra IExecutionValidator alongside the built-in five", () => {
    const { session } = sessionFixture({ definition: definitionFixture() });
    const graph = buildExecutionGraph(session.definition);
    const extraValidator = {
      name: "custom",
      validate: () => ({ valid: false, issues: [{ path: "custom", message: "always fails" }] }),
    };
    const result = new ExecutionValidationPipeline([extraValidator]).run({ session, graph });
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ path: "custom", message: "always fails" });
  });
});
