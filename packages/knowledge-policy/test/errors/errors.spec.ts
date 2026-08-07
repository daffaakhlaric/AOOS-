import { describe, expect, it } from "vitest";

import { DuplicatePolicyEntryException } from "../../src/errors/duplicate-policy-entry-exception.js";
import { IllegalPolicyTransitionException } from "../../src/errors/illegal-policy-transition-exception.js";
import { InvalidPolicyMetadataException } from "../../src/errors/invalid-policy-metadata-exception.js";
import { KnowledgePolicyException } from "../../src/errors/knowledge-policy-exception.js";
import { PolicyAssignmentException } from "../../src/errors/policy-assignment-exception.js";
import { PolicyConfigurationException } from "../../src/errors/policy-configuration-exception.js";
import { PolicyEvaluationException } from "../../src/errors/policy-evaluation-exception.js";
import { PolicyLeaseException } from "../../src/errors/policy-lease-exception.js";
import { PolicyNotFoundException } from "../../src/errors/policy-not-found-exception.js";
import { PolicyOperationException } from "../../src/errors/policy-operation-exception.js";
import { PolicyPermissionDeniedException } from "../../src/errors/policy-permission-denied-exception.js";
import { PolicyRuleException } from "../../src/errors/policy-rule-exception.js";
import { PolicySessionException } from "../../src/errors/policy-session-exception.js";
import { PolicyValidationException } from "../../src/errors/policy-validation-exception.js";
import { PolicyViolationException } from "../../src/errors/policy-violation-exception.js";

const exceptionClasses = [
  DuplicatePolicyEntryException,
  IllegalPolicyTransitionException,
  InvalidPolicyMetadataException,
  PolicyAssignmentException,
  PolicyConfigurationException,
  PolicyEvaluationException,
  PolicyLeaseException,
  PolicyNotFoundException,
  PolicyOperationException,
  PolicyPermissionDeniedException,
  PolicyRuleException,
  PolicySessionException,
  PolicyValidationException,
  PolicyViolationException,
];

describe("KnowledgePolicyException subclasses", () => {
  it.each(exceptionClasses)(
    "%p extends KnowledgePolicyException and carries a message",
    (ExceptionClass) => {
      const error = new ExceptionClass("boom");
      expect(error).toBeInstanceOf(KnowledgePolicyException);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("boom");
      expect(error.name).toBe(ExceptionClass.name);
    },
  );
});

describe("KnowledgePolicyException base", () => {
  it("is instantiable directly", () => {
    const error = new KnowledgePolicyException("base error");
    expect(error.message).toBe("base error");
  });

  it("accepts a cause option", () => {
    const cause = new Error("root cause");
    const error = new KnowledgePolicyException("boom", { cause });
    expect(error.message).toBe("boom");
  });
});
