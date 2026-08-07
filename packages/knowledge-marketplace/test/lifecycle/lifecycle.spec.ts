import { describe, expect, it } from "vitest";

import { MarketplacePackageStatus } from "../../src/domain/marketplace-package-status.js";
import { KnowledgeMarketplaceLifecycle } from "../../src/lifecycle/knowledge-marketplace-lifecycle.js";

describe("KnowledgeMarketplaceLifecycle", () => {
  const lifecycle = new KnowledgeMarketplaceLifecycle();

  it("states returns all 9 states", () => {
    expect(lifecycle.states()).toHaveLength(9);
  });

  it("transitionsFrom Draft includes Submitted", () => {
    expect(lifecycle.transitionsFrom(MarketplacePackageStatus.DRAFT)).toContain(
      MarketplacePackageStatus.SUBMITTED,
    );
  });

  it("transitionsFrom Removed is empty", () => {
    expect(lifecycle.transitionsFrom(MarketplacePackageStatus.REMOVED)).toHaveLength(0);
  });

  it("isTerminal is true for Removed", () => {
    expect(lifecycle.isTerminal(MarketplacePackageStatus.REMOVED)).toBe(true);
  });

  it("isTerminal is false for Draft", () => {
    expect(lifecycle.isTerminal(MarketplacePackageStatus.DRAFT)).toBe(false);
  });

  it("isSettled is true for Archived", () => {
    expect(lifecycle.isSettled(MarketplacePackageStatus.ARCHIVED)).toBe(true);
  });

  it("isSettled is false for Published", () => {
    expect(lifecycle.isSettled(MarketplacePackageStatus.PUBLISHED)).toBe(false);
  });

  it("isSettled is false for Draft", () => {
    expect(lifecycle.isSettled(MarketplacePackageStatus.DRAFT)).toBe(false);
  });

  it("isSettled is true for Suspended", () => {
    expect(lifecycle.isSettled(MarketplacePackageStatus.SUSPENDED)).toBe(true);
  });

  it("isSettled is true for Deprecated", () => {
    expect(lifecycle.isSettled(MarketplacePackageStatus.DEPRECATED)).toBe(true);
  });
});
