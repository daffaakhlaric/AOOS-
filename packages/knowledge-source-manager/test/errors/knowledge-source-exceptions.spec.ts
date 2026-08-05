import { describe, expect, it } from "vitest";

import { CatalogEntryNotFoundException } from "../../src/errors/catalog-entry-not-found-exception.js";
import { DuplicateSourceEntryException } from "../../src/errors/duplicate-source-entry-exception.js";
import { IllegalSourceTransitionException } from "../../src/errors/illegal-source-transition-exception.js";
import { InvalidSourceMetadataException } from "../../src/errors/invalid-source-metadata-exception.js";
import { KnowledgeSourceException } from "../../src/errors/knowledge-source-exception.js";
import { SourceCategoryNotFoundException } from "../../src/errors/source-category-not-found-exception.js";
import { SourceConfigurationException } from "../../src/errors/source-configuration-exception.js";
import { SourceLeaseException } from "../../src/errors/source-lease-exception.js";
import { SourceNotFoundException } from "../../src/errors/source-not-found-exception.js";
import { SourcePermissionDeniedException } from "../../src/errors/source-permission-denied-exception.js";
import { SourcePolicyViolationException } from "../../src/errors/source-policy-violation-exception.js";
import { SourceScheduleException } from "../../src/errors/source-schedule-exception.js";
import { SourceSessionException } from "../../src/errors/source-session-exception.js";
import { SourceValidationException } from "../../src/errors/source-validation-exception.js";

const subclasses = [
  IllegalSourceTransitionException,
  SourceNotFoundException,
  DuplicateSourceEntryException,
  SourceValidationException,
  SourcePermissionDeniedException,
  SourcePolicyViolationException,
  SourceConfigurationException,
  SourceSessionException,
  SourceLeaseException,
  InvalidSourceMetadataException,
  SourceCategoryNotFoundException,
  SourceScheduleException,
  CatalogEntryNotFoundException,
];

describe("KnowledgeSourceException hierarchy", () => {
  it("has 13 concrete subclasses, each extending KnowledgeSourceException", () => {
    expect(subclasses).toHaveLength(13);
    for (const Subclass of subclasses) {
      const instance = new Subclass("boom");
      expect(instance).toBeInstanceOf(KnowledgeSourceException);
      expect(instance).toBeInstanceOf(Error);
      expect(instance.message).toBe("boom");
    }
  });

  it("carries an optional cause/context through the base constructor", () => {
    const cause = new Error("root cause");
    const exception = new SourceNotFoundException("not found", { cause });
    expect(exception.cause).toBe(cause);
  });
});
