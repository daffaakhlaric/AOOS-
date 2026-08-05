import { describe, expect, it } from "vitest";

import { WorkflowBuilder } from "../../src/builder/workflow-builder.js";
import { NodeType } from "../../src/contracts/node-type.js";
import { RetryBackoffStrategy } from "../../src/contracts/retry-config.js";
import { TenantScope } from "../../src/contracts/tenant-scope.js";
import { TransitionKind } from "../../src/contracts/transition-kind.js";
import { VariableScope } from "../../src/contracts/variable-scope.js";
import { BuilderException } from "../../src/errors/builder-exception.js";
import { VariableType } from "../../src/variables/variable-type.js";

describe("Builder API Test — WorkflowBuilder", () => {
  it("builds a minimal WorkflowDefinition with addNode/addTransition/addVariable", () => {
    const workflow = WorkflowBuilder.create("wf-1", "1.0.0")
      .withDisplayName("Workflow 1")
      .withDescription("desc")
      .withNamespace("sales")
      .withLabels({ team: "sales" })
      .withTags(["core"])
      .withTenantScope(TenantScope.TENANT, "tenant-1")
      .withMetadata({ owner: "team-a" })
      .withInput({ in: "x" })
      .withOutput({ out: "y" })
      .withEvents(["workflow.definition.created"])
      .withPermissions(["workflow.execute"])
      .withRetry({
        strategy: RetryBackoffStrategy.EXPONENTIAL,
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30_000,
      })
      .withTimeout({ durationMs: 60_000 })
      .addVariable({
        name: "count",
        type: VariableType.NUMBER,
        scope: VariableScope.WORKFLOW,
        required: false,
      })
      .addNode({ id: "start", name: "Start", type: NodeType.START })
      .addNode({ id: "end", name: "End", type: NodeType.END })
      .addTransition({ id: "t-1", kind: TransitionKind.NEXT, fromNodeId: "start", toNodeId: "end" })
      .build();

    expect(workflow.id).toBe("wf-1");
    expect(workflow.nodes).toHaveLength(2);
    expect(workflow.transitions).toHaveLength(1);
    expect(workflow.variables).toHaveLength(1);
  });

  it("throws BuilderException when no Nodes are added", () => {
    expect(() => WorkflowBuilder.create("wf-2", "1.0.0").build()).toThrow(BuilderException);
  });
});
