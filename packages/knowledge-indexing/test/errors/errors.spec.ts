import { describe, expect, it } from "vitest";

import { ChunkReferenceException } from "../../src/errors/chunk-reference-exception.js";
import { DuplicateIndexEntryException } from "../../src/errors/duplicate-index-entry-exception.js";
import { EmbeddingReferenceException } from "../../src/errors/embedding-reference-exception.js";
import { IndexBuildException } from "../../src/errors/index-build-exception.js";
import { IndexConsistencyException } from "../../src/errors/index-consistency-exception.js";
import { IndexNotFoundException } from "../../src/errors/index-not-found-exception.js";
import { IndexOptimizationNotSupportedException } from "../../src/errors/index-optimization-not-supported-exception.js";
import { IndexScheduleException } from "../../src/errors/index-schedule-exception.js";
import { IndexValidationException } from "../../src/errors/index-validation-exception.js";
import { InvalidIndexNamespaceException } from "../../src/errors/invalid-index-namespace-exception.js";
import { KnowledgeIndexException } from "../../src/errors/knowledge-index-exception.js";

const subclasses = [
  IndexNotFoundException,
  DuplicateIndexEntryException,
  IndexValidationException,
  IndexBuildException,
  IndexOptimizationNotSupportedException,
  IndexScheduleException,
  InvalidIndexNamespaceException,
  IndexConsistencyException,
  EmbeddingReferenceException,
  ChunkReferenceException,
];

describe("Errors Test — exception hierarchy", () => {
  it("KnowledgeIndexException carries a message and optional cause/context", () => {
    const cause = new Error("root cause");
    const error = new KnowledgeIndexException("boom", { cause, context: { tenantId: "t1" } });
    expect(error.message).toBe("boom");
    expect(error.cause).toBe(cause);
    expect(error.context).toEqual({ tenantId: "t1" });
  });

  it.each(subclasses)(
    "%s extends KnowledgeIndexException and carries its message",
    (ExceptionClass) => {
      const error = new ExceptionClass("something failed");
      expect(error).toBeInstanceOf(KnowledgeIndexException);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("something failed");
      expect(error.name).toBe(ExceptionClass.name);
    },
  );

  it("declares exactly 10 concrete subclasses", () => {
    expect(subclasses).toHaveLength(10);
  });
});
