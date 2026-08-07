import { describe, expect, it } from "vitest";

import { BranchNotFoundException } from "../../src/errors/branch-not-found-exception.js";
import { DuplicateVersionEntryException } from "../../src/errors/duplicate-version-entry-exception.js";
import { IllegalVersionTransitionException } from "../../src/errors/illegal-version-transition-exception.js";
import { InvalidVersionMetadataException } from "../../src/errors/invalid-version-metadata-exception.js";
import { KnowledgeVersionException } from "../../src/errors/knowledge-version-exception.js";
import { SnapshotLimitExceededException } from "../../src/errors/snapshot-limit-exceeded-exception.js";
import { VersionConfigurationException } from "../../src/errors/version-configuration-exception.js";
import { VersionLeaseException } from "../../src/errors/version-lease-exception.js";
import { VersionLineageException } from "../../src/errors/version-lineage-exception.js";
import { VersionNotFoundException } from "../../src/errors/version-not-found-exception.js";
import { VersionOperationException } from "../../src/errors/version-operation-exception.js";
import { VersionPermissionDeniedException } from "../../src/errors/version-permission-denied-exception.js";
import { VersionPolicyViolationException } from "../../src/errors/version-policy-violation-exception.js";
import { VersionSessionException } from "../../src/errors/version-session-exception.js";
import { VersionValidationException } from "../../src/errors/version-validation-exception.js";

const exceptionClasses = [
  BranchNotFoundException,
  DuplicateVersionEntryException,
  IllegalVersionTransitionException,
  InvalidVersionMetadataException,
  SnapshotLimitExceededException,
  VersionConfigurationException,
  VersionLeaseException,
  VersionLineageException,
  VersionNotFoundException,
  VersionOperationException,
  VersionPermissionDeniedException,
  VersionPolicyViolationException,
  VersionSessionException,
  VersionValidationException,
];

describe("KnowledgeVersionException subclasses", () => {
  it.each(exceptionClasses)(
    "%p extends KnowledgeVersionException and carries a message",
    (ExceptionClass) => {
      const error = new ExceptionClass("boom");
      expect(error).toBeInstanceOf(KnowledgeVersionException);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("boom");
    },
  );

  it.each(exceptionClasses)("%p accepts a cause option", (ExceptionClass) => {
    const cause = new Error("root cause");
    const error = new ExceptionClass("boom", { cause });
    expect(error.message).toBe("boom");
  });
});

describe("KnowledgeVersionException base", () => {
  it("is instantiable directly", () => {
    const error = new KnowledgeVersionException("base error");
    expect(error.message).toBe("base error");
  });
});
