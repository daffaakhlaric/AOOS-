import { describe, expect, it } from "vitest";

import { NodeBuilder } from "../../src/builder/node-builder.js";
import { NodeType } from "../../src/contracts/node-type.js";
import { RetryBackoffStrategy } from "../../src/contracts/retry-config.js";
import { BuilderException } from "../../src/errors/builder-exception.js";

describe("Builder API Test — NodeBuilder", () => {
  it("builds a minimal Start node", () => {
    const node = NodeBuilder.create("start", NodeType.START).withName("Start").build();
    expect(node).toMatchObject({ id: "start", type: NodeType.START, name: "Start" });
  });

  it("builds a Capability node using the .set() escape hatch", () => {
    const node = NodeBuilder.create("cap", NodeType.CAPABILITY)
      .withName("Do capability")
      .set("capability", "inventory.read")
      .build();
    expect(node).toMatchObject({
      id: "cap",
      type: NodeType.CAPABILITY,
      capability: "inventory.read",
    });
  });

  it("builds using every base field setter", () => {
    const node = NodeBuilder.create("task-1", NodeType.TASK)
      .withName("Task 1")
      .withDescription("desc")
      .withInput({ in: "x" })
      .withOutput({ out: "y" })
      .withVariables([])
      .withRetry({
        strategy: RetryBackoffStrategy.EXPONENTIAL,
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30_000,
      })
      .withTimeout({ durationMs: 1000 })
      .withCompensation({ compensationNodeId: "comp" })
      .withMetadata({ owner: "team-a" })
      .build();
    expect(node.description).toBe("desc");
    expect(node.metadata).toEqual({ owner: "team-a" });
  });

  it("throws BuilderException when required Node-Type-specific fields are missing", () => {
    expect(() => NodeBuilder.create("cap", NodeType.CAPABILITY).withName("Bad").build()).toThrow(
      BuilderException,
    );
  });

  it("reports the discriminator field path when the Node Type itself is invalid", () => {
    expect(() =>
      NodeBuilder.create("n-1", "BOGUS" as NodeType)
        .withName("Bad")
        .build(),
    ).toThrow(/^Failed to build Node "n-1": type: /);
  });
});
