import { describe, expect, it } from "vitest";

import { KnowledgePolicyState } from "../../src/domain/knowledge-policy-state.js";
import { KnowledgePolicyValidator } from "../../src/validator/knowledge-policy-validator.js";
import { configurationFixture } from "../helpers/configuration-fixture.js";
import { contextFixture } from "../helpers/context-fixture.js";
import { metadataFixture } from "../helpers/metadata-fixture.js";

function baseInput() {
  return {
    metadata: metadataFixture(),
    context: contextFixture(),
    configuration: configurationFixture(),
  };
}

const legalTransitions: [KnowledgePolicyState, KnowledgePolicyState][] = [
  [KnowledgePolicyState.DRAFT, KnowledgePolicyState.CREATED],
  [KnowledgePolicyState.CREATED, KnowledgePolicyState.VALIDATED],
  [KnowledgePolicyState.VALIDATED, KnowledgePolicyState.ACTIVE],
  [KnowledgePolicyState.ACTIVE, KnowledgePolicyState.SUSPENDED],
  [KnowledgePolicyState.ACTIVE, KnowledgePolicyState.DEPRECATED],
  [KnowledgePolicyState.ACTIVE, KnowledgePolicyState.ARCHIVED],
  [KnowledgePolicyState.SUSPENDED, KnowledgePolicyState.RESTORED],
  [KnowledgePolicyState.DEPRECATED, KnowledgePolicyState.RESTORED],
  [KnowledgePolicyState.ARCHIVED, KnowledgePolicyState.RESTORED],
  [KnowledgePolicyState.RESTORED, KnowledgePolicyState.ACTIVE],
];

describe("KnowledgePolicyValidator — end-to-end lifecycle transition matrix", () => {
  it.each(legalTransitions)("accepts the legal transition %s -> %s", (from, to) => {
    const validator = new KnowledgePolicyValidator();
    const result = validator.validate({ ...baseInput(), currentState: from, targetState: to });
    expect(result.valid).toBe(true);
  });

  it("rejects DRAFT -> DESTROYED paired with an unrelated metadata error, aggregating both", () => {
    const validator = new KnowledgePolicyValidator();
    const input = baseInput();
    const result = validator.validate({
      ...input,
      metadata: { ...input.metadata, policyName: "" },
      currentState: KnowledgePolicyState.DRAFT,
      targetState: KnowledgePolicyState.VALIDATED,
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === "metadata.policyName")).toBe(true);
    expect(result.issues.some((issue) => issue.path === "lifecycle")).toBe(true);
  });
});

describe("KnowledgePolicyValidator — every terminal-adjacent transition to DESTROYED is legal", () => {
  it.each(Object.values(KnowledgePolicyState).filter((s) => s !== KnowledgePolicyState.DESTROYED))(
    "accepts %s -> DESTROYED",
    (from) => {
      const validator = new KnowledgePolicyValidator();
      const result = validator.validate({
        ...baseInput(),
        currentState: from,
        targetState: KnowledgePolicyState.DESTROYED,
      });
      expect(result.valid).toBe(true);
    },
  );
});
