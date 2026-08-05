import { AosError } from "@aos/errors";
import { describe, expect, it } from "vitest";

import { CapabilityNotSupportedException } from "../../src/errors/capability-not-supported-exception.js";
import { CategoryNotFoundException } from "../../src/errors/category-not-found-exception.js";
import { DuplicateProviderEntryException } from "../../src/errors/duplicate-provider-entry-exception.js";
import { IllegalProviderTransitionException } from "../../src/errors/illegal-provider-transition-exception.js";
import { InvalidProviderMetadataException } from "../../src/errors/invalid-provider-metadata-exception.js";
import { KnowledgeProviderException } from "../../src/errors/knowledge-provider-exception.js";
import { ProviderConfigurationException } from "../../src/errors/provider-configuration-exception.js";
import { ProviderLeaseException } from "../../src/errors/provider-lease-exception.js";
import { ProviderNotFoundException } from "../../src/errors/provider-not-found-exception.js";
import { ProviderPermissionDeniedException } from "../../src/errors/provider-permission-denied-exception.js";
import { ProviderPolicyViolationException } from "../../src/errors/provider-policy-violation-exception.js";
import { ProviderSessionException } from "../../src/errors/provider-session-exception.js";
import { ProviderValidationException } from "../../src/errors/provider-validation-exception.js";

describe("KnowledgeProviderException", () => {
  it("extends AosError", () => {
    expect(new KnowledgeProviderException("boom")).toBeInstanceOf(AosError);
  });

  it("carries the message", () => {
    expect(new KnowledgeProviderException("boom").message).toBe("boom");
  });

  it("carries an optional cause", () => {
    const cause = new Error("root cause");
    const error = new KnowledgeProviderException("boom", { cause });
    expect(error.cause).toBe(cause);
  });
});

describe.each([
  ["IllegalProviderTransitionException", IllegalProviderTransitionException],
  ["ProviderNotFoundException", ProviderNotFoundException],
  ["DuplicateProviderEntryException", DuplicateProviderEntryException],
  ["ProviderValidationException", ProviderValidationException],
  ["ProviderPermissionDeniedException", ProviderPermissionDeniedException],
  ["ProviderPolicyViolationException", ProviderPolicyViolationException],
  ["ProviderConfigurationException", ProviderConfigurationException],
  ["CapabilityNotSupportedException", CapabilityNotSupportedException],
  ["ProviderSessionException", ProviderSessionException],
  ["ProviderLeaseException", ProviderLeaseException],
  ["InvalidProviderMetadataException", InvalidProviderMetadataException],
  ["CategoryNotFoundException", CategoryNotFoundException],
])("%s", (name, ExceptionClass) => {
  it(`is a ${name} extending KnowledgeProviderException`, () => {
    const error = new ExceptionClass("something went wrong");
    expect(error).toBeInstanceOf(KnowledgeProviderException);
    expect(error.message).toBe("something went wrong");
  });
});
