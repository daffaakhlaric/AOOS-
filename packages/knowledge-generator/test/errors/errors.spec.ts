import { describe, expect, it } from "vitest";

import { DuplicateGeneratorEntryException } from "../../src/errors/duplicate-generator-entry-exception.js";
import { GenerationContextException } from "../../src/errors/generation-context-exception.js";
import { GenerationPolicyException } from "../../src/errors/generation-policy-exception.js";
import { GenerationPromptException } from "../../src/errors/generation-prompt-exception.js";
import { GenerationProviderException } from "../../src/errors/generation-provider-exception.js";
import { GenerationValidationException } from "../../src/errors/generation-validation-exception.js";
import { GeneratorConfigurationException } from "../../src/errors/generator-configuration-exception.js";
import { GeneratorLeaseException } from "../../src/errors/generator-lease-exception.js";
import { GeneratorNotFoundException } from "../../src/errors/generator-not-found-exception.js";
import { GeneratorOperationException } from "../../src/errors/generator-operation-exception.js";
import { GeneratorSessionException } from "../../src/errors/generator-session-exception.js";
import { IllegalGenerationTransitionException } from "../../src/errors/illegal-generation-transition-exception.js";
import { InvalidGenerationMetadataException } from "../../src/errors/invalid-generation-metadata-exception.js";
import { KnowledgeGeneratorException } from "../../src/errors/knowledge-generator-exception.js";

const EXCEPTIONS = [
  DuplicateGeneratorEntryException,
  GenerationContextException,
  GenerationPolicyException,
  GenerationPromptException,
  GenerationProviderException,
  GenerationValidationException,
  GeneratorConfigurationException,
  GeneratorLeaseException,
  GeneratorNotFoundException,
  GeneratorOperationException,
  GeneratorSessionException,
  IllegalGenerationTransitionException,
  InvalidGenerationMetadataException,
];

describe("Knowledge Generator error hierarchy", () => {
  it("KnowledgeGeneratorException carries the message", () => {
    const error = new KnowledgeGeneratorException("boom");
    expect(error.message).toBe("boom");
  });

  it("KnowledgeGeneratorException accepts cause/context options", () => {
    const cause = new Error("root cause");
    const error = new KnowledgeGeneratorException("boom", { cause, context: { key: "value" } });
    expect(error.cause).toBe(cause);
  });

  it.each(EXCEPTIONS)("%s extends KnowledgeGeneratorException", (ExceptionClass) => {
    const error = new ExceptionClass("message");
    expect(error).toBeInstanceOf(KnowledgeGeneratorException);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("message");
  });

  it.each(EXCEPTIONS)("%s is throwable and catchable", (ExceptionClass) => {
    expect(() => {
      throw new ExceptionClass("thrown");
    }).toThrow(ExceptionClass);
  });
});
