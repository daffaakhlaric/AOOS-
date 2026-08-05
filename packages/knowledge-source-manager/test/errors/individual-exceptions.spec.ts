import { describe, expect, it } from "vitest";

import { CatalogEntryNotFoundException } from "../../src/errors/catalog-entry-not-found-exception.js";
import { DuplicateSourceEntryException } from "../../src/errors/duplicate-source-entry-exception.js";
import { IllegalSourceTransitionException } from "../../src/errors/illegal-source-transition-exception.js";
import { InvalidSourceMetadataException } from "../../src/errors/invalid-source-metadata-exception.js";
import { SourceCategoryNotFoundException } from "../../src/errors/source-category-not-found-exception.js";
import { SourceConfigurationException } from "../../src/errors/source-configuration-exception.js";
import { SourceLeaseException } from "../../src/errors/source-lease-exception.js";
import { SourceNotFoundException } from "../../src/errors/source-not-found-exception.js";
import { SourcePermissionDeniedException } from "../../src/errors/source-permission-denied-exception.js";
import { SourcePolicyViolationException } from "../../src/errors/source-policy-violation-exception.js";
import { SourceScheduleException } from "../../src/errors/source-schedule-exception.js";
import { SourceSessionException } from "../../src/errors/source-session-exception.js";
import { SourceValidationException } from "../../src/errors/source-validation-exception.js";

describe("individual exception identity", () => {
  it("IllegalSourceTransitionException carries its own message", () => {
    expect(new IllegalSourceTransitionException("illegal").message).toBe("illegal");
  });

  it("SourceNotFoundException carries its own message", () => {
    expect(new SourceNotFoundException("missing").message).toBe("missing");
  });

  it("DuplicateSourceEntryException carries its own message", () => {
    expect(new DuplicateSourceEntryException("duplicate").message).toBe("duplicate");
  });

  it("SourceValidationException carries its own message", () => {
    expect(new SourceValidationException("invalid").message).toBe("invalid");
  });

  it("SourcePermissionDeniedException carries its own message", () => {
    expect(new SourcePermissionDeniedException("denied").message).toBe("denied");
  });

  it("SourcePolicyViolationException carries its own message", () => {
    expect(new SourcePolicyViolationException("violated").message).toBe("violated");
  });

  it("SourceConfigurationException carries its own message", () => {
    expect(new SourceConfigurationException("bad config").message).toBe("bad config");
  });

  it("SourceSessionException carries its own message", () => {
    expect(new SourceSessionException("bad session").message).toBe("bad session");
  });

  it("SourceLeaseException carries its own message", () => {
    expect(new SourceLeaseException("expired lease").message).toBe("expired lease");
  });

  it("InvalidSourceMetadataException carries its own message", () => {
    expect(new InvalidSourceMetadataException("bad metadata").message).toBe("bad metadata");
  });

  it("SourceCategoryNotFoundException carries its own message", () => {
    expect(new SourceCategoryNotFoundException("no category").message).toBe("no category");
  });

  it("SourceScheduleException carries its own message", () => {
    expect(new SourceScheduleException("bad schedule").message).toBe("bad schedule");
  });

  it("CatalogEntryNotFoundException carries its own message", () => {
    expect(new CatalogEntryNotFoundException("no catalog entry").message).toBe("no catalog entry");
  });
});
