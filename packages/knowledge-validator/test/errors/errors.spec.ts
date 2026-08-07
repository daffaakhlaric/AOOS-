import { describe, expect, it } from "vitest";

import { DuplicateValidatorEntryException } from "../../src/errors/duplicate-validator-entry-exception.js";
import { IllegalValidationTransitionException } from "../../src/errors/illegal-validation-transition-exception.js";
import { InvalidValidationMetadataException } from "../../src/errors/invalid-validation-metadata-exception.js";
import { KnowledgeValidatorException } from "../../src/errors/knowledge-validator-exception.js";
import { ValidationCheckException } from "../../src/errors/validation-check-exception.js";
import { ValidatorConfigurationException } from "../../src/errors/validator-configuration-exception.js";
import { ValidatorDecisionException } from "../../src/errors/validator-decision-exception.js";
import { ValidatorFindingException } from "../../src/errors/validator-finding-exception.js";
import { ValidatorLeaseException } from "../../src/errors/validator-lease-exception.js";
import { ValidatorNotFoundException } from "../../src/errors/validator-not-found-exception.js";
import { ValidatorOperationException } from "../../src/errors/validator-operation-exception.js";
import { ValidatorPolicyException } from "../../src/errors/validator-policy-exception.js";
import { ValidatorRuleException } from "../../src/errors/validator-rule-exception.js";
import { ValidatorSessionException } from "../../src/errors/validator-session-exception.js";

const classes = [
  KnowledgeValidatorException,
  ValidatorNotFoundException,
  DuplicateValidatorEntryException,
  IllegalValidationTransitionException,
  InvalidValidationMetadataException,
  ValidationCheckException,
  ValidatorOperationException,
  ValidatorConfigurationException,
  ValidatorSessionException,
  ValidatorLeaseException,
  ValidatorPolicyException,
  ValidatorRuleException,
  ValidatorDecisionException,
  ValidatorFindingException,
];

describe("Exception hierarchy", () => {
  it.each(classes)("%s carries the message", (ExceptionClass) => {
    const error = new ExceptionClass("boom");
    expect(error.message).toBe("boom");
  });

  it.each(classes.filter((c) => c !== KnowledgeValidatorException))(
    "%s is an instance of KnowledgeValidatorException",
    (ExceptionClass) => {
      const error = new ExceptionClass("boom");
      expect(error).toBeInstanceOf(KnowledgeValidatorException);
    },
  );

  it.each(classes)("%s is an instance of Error", (ExceptionClass) => {
    const error = new ExceptionClass("boom");
    expect(error).toBeInstanceOf(Error);
  });

  it("carries an optional cause", () => {
    const cause = new Error("root cause");
    const error = new ValidatorNotFoundException("boom", { cause });
    expect(error.cause).toBe(cause);
  });

  it("carries an optional context", () => {
    const error = new ValidatorNotFoundException("boom", { context: { foo: "bar" } });
    expect(error.context).toEqual({ foo: "bar" });
  });
});
