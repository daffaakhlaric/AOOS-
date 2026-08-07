import { describe, expect, it } from "vitest";

import { DuplicateMarketplaceEntryException } from "../../src/errors/duplicate-marketplace-entry-exception.js";
import { IllegalMarketplaceTransitionException } from "../../src/errors/illegal-marketplace-transition-exception.js";
import { InvalidMarketplaceMetadataException } from "../../src/errors/invalid-marketplace-metadata-exception.js";
import { KnowledgeMarketplaceException } from "../../src/errors/knowledge-marketplace-exception.js";
import { MarketplaceCategoryException } from "../../src/errors/marketplace-category-exception.js";
import { MarketplaceCompatibilityException } from "../../src/errors/marketplace-compatibility-exception.js";
import { MarketplaceConfigurationException } from "../../src/errors/marketplace-configuration-exception.js";
import { MarketplaceDependencyException } from "../../src/errors/marketplace-dependency-exception.js";
import { MarketplaceLeaseException } from "../../src/errors/marketplace-lease-exception.js";
import { MarketplaceNotFoundException } from "../../src/errors/marketplace-not-found-exception.js";
import { MarketplaceOperationException } from "../../src/errors/marketplace-operation-exception.js";
import { MarketplaceSessionException } from "../../src/errors/marketplace-session-exception.js";
import { MarketplaceValidationException } from "../../src/errors/marketplace-validation-exception.js";

const EXCEPTIONS = [
  DuplicateMarketplaceEntryException,
  IllegalMarketplaceTransitionException,
  InvalidMarketplaceMetadataException,
  MarketplaceCategoryException,
  MarketplaceCompatibilityException,
  MarketplaceConfigurationException,
  MarketplaceDependencyException,
  MarketplaceLeaseException,
  MarketplaceNotFoundException,
  MarketplaceOperationException,
  MarketplaceSessionException,
  MarketplaceValidationException,
];

describe("errors", () => {
  it("KnowledgeMarketplaceException carries the message", () => {
    const error = new KnowledgeMarketplaceException("boom");
    expect(error.message).toBe("boom");
  });

  it("KnowledgeMarketplaceException is an Error", () => {
    expect(new KnowledgeMarketplaceException("boom")).toBeInstanceOf(Error);
  });

  it("KnowledgeMarketplaceException accepts a cause", () => {
    const cause = new Error("root cause");
    const error = new KnowledgeMarketplaceException("boom", { cause });
    expect(error.cause).toBe(cause);
  });

  it.each(EXCEPTIONS)("%s extends KnowledgeMarketplaceException", (ExceptionClass) => {
    const error = new ExceptionClass("failure");
    expect(error).toBeInstanceOf(KnowledgeMarketplaceException);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("failure");
  });

  it("there are exactly 12 concrete exception classes", () => {
    expect(EXCEPTIONS).toHaveLength(12);
  });

  it.each(EXCEPTIONS)("%s accepts an options bag with a cause", (ExceptionClass) => {
    const cause = new Error("root cause");
    const error = new ExceptionClass("failure", { cause });
    expect(error.cause).toBe(cause);
  });

  it("MarketplaceNotFoundException carries a distinguishing message per lookup", () => {
    const error = new MarketplaceNotFoundException('No entry "x" registered in bucket "package"');
    expect(error.message).toContain("package");
  });
});
