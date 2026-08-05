import { describe, expect, it } from "vitest";

import { NodeType } from "../../src/contracts/node-type.js";
import { TransitionKind } from "../../src/contracts/transition-kind.js";
import type {
  IWorkflowValidator,
  ValidationResult,
} from "../../src/validator/i-workflow-validator.js";
import { ValidationPipeline } from "../../src/validator/validation-pipeline.js";
import { workflowFixture } from "../helpers/workflow-fixture.js";

describe("ValidationPipeline", () => {
  it("passes a fully valid workflow", () => {
    const result = new ValidationPipeline().run(workflowFixture());
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("aggregates issues from multiple stages without short-circuiting", () => {
    const workflow = workflowFixture({
      version: "not-semver",
      nodes: [
        { id: "start", name: "S", type: NodeType.START },
        { id: "start", name: "S2", type: NodeType.START },
      ],
      transitions: [
        { id: "t-1", kind: TransitionKind.NEXT, fromNodeId: "start", toNodeId: "missing" },
      ],
    });
    const result = new ValidationPipeline().run(workflow);
    expect(result.valid).toBe(false);
    // Structural (no End node), Transition (missing toNodeId), Duplicate (dup node id), Version (bad semver)
    expect(result.issues.length).toBeGreaterThanOrEqual(4);
  });

  it("runs supplied extraValidators in addition to the built-in stages", () => {
    const extra: IWorkflowValidator = {
      name: "AlwaysFails",
      validate: (): ValidationResult => ({
        valid: false,
        issues: [{ path: "$", message: "custom failure" }],
      }),
    };
    const result = new ValidationPipeline([extra]).run(workflowFixture());
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.message === "custom failure")).toBe(true);
  });
});
