import { describe, expect, it } from "vitest";

import { KnowledgeValidationState } from "../../src/domain/knowledge-validation-state.js";
import { KnowledgeValidatorLifecycle } from "../../src/lifecycle/knowledge-validator-lifecycle.js";

describe("KnowledgeValidatorLifecycle", () => {
  it("states returns all 10 states", () => {
    const lifecycle = new KnowledgeValidatorLifecycle();
    expect(lifecycle.states()).toHaveLength(10);
  });

  it("transitionsFrom returns the legal edges for Draft", () => {
    const lifecycle = new KnowledgeValidatorLifecycle();
    expect(lifecycle.transitionsFrom(KnowledgeValidationState.DRAFT)).toContain(
      KnowledgeValidationState.QUEUED,
    );
  });

  it("isTerminal is true only for Destroyed", () => {
    const lifecycle = new KnowledgeValidatorLifecycle();
    expect(lifecycle.isTerminal(KnowledgeValidationState.DESTROYED)).toBe(true);
    expect(lifecycle.isTerminal(KnowledgeValidationState.APPROVED)).toBe(false);
  });

  it("isSettled is true for Approved", () => {
    const lifecycle = new KnowledgeValidatorLifecycle();
    expect(lifecycle.isSettled(KnowledgeValidationState.APPROVED)).toBe(true);
  });

  it("isSettled is true for Rejected", () => {
    const lifecycle = new KnowledgeValidatorLifecycle();
    expect(lifecycle.isSettled(KnowledgeValidationState.REJECTED)).toBe(true);
  });

  it("isSettled is true for Cancelled", () => {
    const lifecycle = new KnowledgeValidatorLifecycle();
    expect(lifecycle.isSettled(KnowledgeValidationState.CANCELLED)).toBe(true);
  });

  it("isSettled is true for Archived", () => {
    const lifecycle = new KnowledgeValidatorLifecycle();
    expect(lifecycle.isSettled(KnowledgeValidationState.ARCHIVED)).toBe(true);
  });

  it("isSettled is true for Destroyed", () => {
    const lifecycle = new KnowledgeValidatorLifecycle();
    expect(lifecycle.isSettled(KnowledgeValidationState.DESTROYED)).toBe(true);
  });

  it("isSettled is false for Draft", () => {
    const lifecycle = new KnowledgeValidatorLifecycle();
    expect(lifecycle.isSettled(KnowledgeValidationState.DRAFT)).toBe(false);
  });

  it("isSettled is false for Reviewing", () => {
    const lifecycle = new KnowledgeValidatorLifecycle();
    expect(lifecycle.isSettled(KnowledgeValidationState.REVIEWING)).toBe(false);
  });
});
