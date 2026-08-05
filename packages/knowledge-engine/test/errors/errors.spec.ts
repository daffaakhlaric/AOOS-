import { AosError } from "@aos/errors";
import { describe, expect, it } from "vitest";

import { AssetNotFoundException } from "../../src/errors/asset-not-found-exception.js";
import { DuplicateAssetException } from "../../src/errors/duplicate-asset-exception.js";
import { IllegalLifecycleTransitionException } from "../../src/errors/illegal-lifecycle-transition-exception.js";
import { InvalidNamespaceException } from "../../src/errors/invalid-namespace-exception.js";
import { InvalidRelationshipException } from "../../src/errors/invalid-relationship-exception.js";
import { KnowledgeException } from "../../src/errors/knowledge-exception.js";
import { KnowledgeValidationException } from "../../src/errors/knowledge-validation-exception.js";
import { PermissionDeniedException } from "../../src/errors/permission-denied-exception.js";
import { PolicyViolationException } from "../../src/errors/policy-violation-exception.js";
import { TemplateNotFoundException } from "../../src/errors/template-not-found-exception.js";
import { VersionConflictException } from "../../src/errors/version-conflict-exception.js";

describe("Errors Test — @aos/knowledge-engine exception hierarchy", () => {
  it("KnowledgeException extends AosError and carries its message", () => {
    const error = new KnowledgeException("base failure");
    expect(error).toBeInstanceOf(AosError);
    expect(error.message).toBe("base failure");
  });

  it.each([
    ["AssetNotFoundException", AssetNotFoundException],
    ["DuplicateAssetException", DuplicateAssetException],
    ["IllegalLifecycleTransitionException", IllegalLifecycleTransitionException],
    ["InvalidNamespaceException", InvalidNamespaceException],
    ["InvalidRelationshipException", InvalidRelationshipException],
    ["KnowledgeValidationException", KnowledgeValidationException],
    ["PermissionDeniedException", PermissionDeniedException],
    ["PolicyViolationException", PolicyViolationException],
    ["TemplateNotFoundException", TemplateNotFoundException],
    ["VersionConflictException", VersionConflictException],
  ] as const)(
    "%s extends KnowledgeException and preserves its message",
    (_name, ExceptionClass) => {
      const error = new ExceptionClass("something went wrong");
      expect(error).toBeInstanceOf(KnowledgeException);
      expect(error).toBeInstanceOf(AosError);
      expect(error.message).toBe("something went wrong");
    },
  );

  it("accepts an optional cause/context via options", () => {
    const cause = new Error("root cause");
    const error = new AssetNotFoundException("not found", { cause, context: { assetId: "a-1" } });
    expect(error.cause).toBe(cause);
  });
});
