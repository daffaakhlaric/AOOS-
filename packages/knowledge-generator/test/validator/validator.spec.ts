import { describe, expect, it } from "vitest";

import type { KnowledgeGeneratorValidationInput } from "../../src/contracts/i-knowledge-generator-validator.js";
import { KnowledgeGenerationAssetType } from "../../src/domain/knowledge-generation-asset-type.js";
import { KnowledgeGenerationMode } from "../../src/domain/knowledge-generation-mode.js";
import { KnowledgeGenerationProviderType } from "../../src/domain/knowledge-generation-provider-type.js";
import { KnowledgeGenerationState } from "../../src/domain/knowledge-generation-state.js";
import { AuditValidator } from "../../src/validator/audit-validator.js";
import { ConfigurationValidator } from "../../src/validator/configuration-validator.js";
import { ContextValidator } from "../../src/validator/context-validator.js";
import { DependencyValidator } from "../../src/validator/dependency-validator.js";
import { IdentityValidator } from "../../src/validator/identity-validator.js";
import { IntegrityValidator } from "../../src/validator/integrity-validator.js";
import { KnowledgeGeneratorValidator } from "../../src/validator/knowledge-generator-validator.js";
import { LifecycleValidator } from "../../src/validator/lifecycle-validator.js";
import { MetadataValidator } from "../../src/validator/metadata-validator.js";
import { PolicyValidator } from "../../src/validator/policy-validator.js";
import { PromptValidator } from "../../src/validator/prompt-validator.js";
import { ProviderValidator } from "../../src/validator/provider-validator.js";
import { RequestValidator } from "../../src/validator/request-validator.js";
import { contextFixture } from "../helpers/context-fixture.js";

const now = new Date().toISOString();

function validInput(): KnowledgeGeneratorValidationInput {
  const context = contextFixture({ generationId: "g-1", tenantId: "tenant-1" });
  return {
    generation: {
      id: "g-1",
      token: context.token,
      generationId: "g-1",
      tenantId: "tenant-1",
      state: KnowledgeGenerationState.DRAFT,
      createdAt: now,
      updatedAt: now,
    },
    metadata: {
      generationId: "g-1",
      title: "Title",
      tenantId: "tenant-1",
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
    request: {
      id: "r-1",
      requestId: "r-1",
      generationId: "g-1",
      assetType: KnowledgeGenerationAssetType.FAQ,
      mode: KnowledgeGenerationMode.CREATE,
      providerType: KnowledgeGenerationProviderType.OPENAI,
      promptReferenceId: "prompt-1",
      requestedBy: "user-1",
      createdAt: now,
    },
    context,
    promptResolvable: true,
  };
}

describe("KnowledgeGeneratorValidator (aggregate)", () => {
  it("has exactly 12 built-in stages", () => {
    const validator = new KnowledgeGeneratorValidator();
    expect(validator.stageNames).toEqual([
      "identity",
      "metadata",
      "request",
      "context",
      "prompt",
      "policy",
      "provider",
      "configuration",
      "lifecycle",
      "dependency",
      "integrity",
      "audit",
    ]);
  });

  it("passes a fully valid input", () => {
    const validator = new KnowledgeGeneratorValidator();
    const result = validator.validate(validInput());
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("aggregates issues from multiple failing stages without short-circuiting", () => {
    const validator = new KnowledgeGeneratorValidator();
    const input: KnowledgeGeneratorValidationInput = {
      ...validInput(),
      metadata: { ...validInput().metadata, title: "" },
      request: { ...validInput().request, requestedBy: "" },
    };
    const result = validator.validate(input);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("supports extraStages", () => {
    const validator = new KnowledgeGeneratorValidator({
      extraStages: [
        {
          name: "custom",
          validate: () => ({ valid: false, issues: [{ path: "custom", message: "nope" }] }),
        },
      ],
    });
    const result = validator.validate(validInput());
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual({ path: "custom", message: "nope" });
    expect(validator.stageNames).toContain("custom");
  });
});

describe("Stage 1 — IdentityValidator", () => {
  const stage = new IdentityValidator();

  it("passes a consistent identity", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("flags a blank generationId", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      generation: { ...input.generation, generationId: "" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags mismatched metadata.generationId", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      metadata: { ...input.metadata, generationId: "other" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags mismatched request.generationId", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, generationId: "other" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a malformed context token", () => {
    const input = validInput();
    const result = stage.validate({ ...input, context: { ...input.context, token: "bad" } });
    expect(result.valid).toBe(false);
  });
});

describe("Stage 2 — MetadataValidator", () => {
  const stage = new MetadataValidator();

  it("passes valid metadata", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("flags a blank title", () => {
    const input = validInput();
    expect(stage.validate({ ...input, metadata: { ...input.metadata, title: "" } }).valid).toBe(
      false,
    );
  });

  it("flags a blank tenantId", () => {
    const input = validInput();
    expect(stage.validate({ ...input, metadata: { ...input.metadata, tenantId: "" } }).valid).toBe(
      false,
    );
  });

  it("flags a malformed createdAt", () => {
    const input = validInput();
    expect(
      stage.validate({ ...input, metadata: { ...input.metadata, createdAt: "not-a-date" } }).valid,
    ).toBe(false);
  });

  it("flags a malformed updatedAt", () => {
    const input = validInput();
    expect(
      stage.validate({ ...input, metadata: { ...input.metadata, updatedAt: "not-a-date" } }).valid,
    ).toBe(false);
  });
});

describe("Stage 3 — RequestValidator", () => {
  const stage = new RequestValidator();

  it("passes a valid Request", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("flags a blank requestId", () => {
    const input = validInput();
    expect(stage.validate({ ...input, request: { ...input.request, requestId: "" } }).valid).toBe(
      false,
    );
  });

  it("flags a blank requestedBy", () => {
    const input = validInput();
    expect(stage.validate({ ...input, request: { ...input.request, requestedBy: "" } }).valid).toBe(
      false,
    );
  });

  it("flags an unknown assetType", () => {
    const input = validInput();
    expect(
      stage.validate({
        ...input,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        request: { ...input.request, assetType: "unknown" as any },
      }).valid,
    ).toBe(false);
  });

  it("flags an unknown mode", () => {
    const input = validInput();
    expect(
      stage.validate({
        ...input,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        request: { ...input.request, mode: "unknown" as any },
      }).valid,
    ).toBe(false);
  });
});

describe("Stage 4 — ContextValidator", () => {
  const stage = new ContextValidator();

  it("passes when no Context Reference is declared", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("passes when the declared Context Reference resolves", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, contextReferenceId: "context-1" },
      contextResolvable: true,
    });
    expect(result.valid).toBe(true);
  });

  it("flags a declared but unresolvable Context Reference", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, contextReferenceId: "context-1" },
      contextResolvable: false,
    });
    expect(result.valid).toBe(false);
  });
});

describe("Stage 5 — PromptValidator", () => {
  const stage = new PromptValidator();

  it("passes when the declared Prompt Reference resolves", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("flags a declared but unresolvable Prompt Reference", () => {
    const input = validInput();
    const result = stage.validate({ ...input, promptResolvable: false });
    expect(result.valid).toBe(false);
  });

  it("passes when no Prompt Reference is declared", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, promptReferenceId: undefined },
      promptResolvable: undefined,
    });
    expect(result.valid).toBe(true);
  });
});

describe("Stage 6 — PolicyValidator", () => {
  const stage = new PolicyValidator();

  it("passes when no Policy is declared", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("flags a declared but unresolvable Policy", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, policyId: "policy-1" },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a resolved Policy that denies the Request", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, policyId: "policy-1" },
      policy: {
        id: "policy-1",
        policyId: "policy-1",
        name: "Policy",
        tenantId: "tenant-1",
        allowedAssetTypes: [KnowledgeGenerationAssetType.SOP],
        allowedProviderTypes: [],
        allowedModes: [],
        requireApproval: false,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(result.valid).toBe(false);
  });

  it("passes a resolved Policy that allows the Request", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, policyId: "policy-1" },
      policy: {
        id: "policy-1",
        policyId: "policy-1",
        name: "Policy",
        tenantId: "tenant-1",
        allowedAssetTypes: [],
        allowedProviderTypes: [],
        allowedModes: [],
        requireApproval: false,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(result.valid).toBe(true);
  });
});

describe("Stage 7 — ProviderValidator", () => {
  const stage = new ProviderValidator();

  it("passes a known, available Provider Type", () => {
    const result = stage.validate({ ...validInput(), providerAvailable: true });
    expect(result.valid).toBe(true);
  });

  it("flags an unknown Provider Type", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      request: { ...input.request, providerType: "unknown" as any },
    });
    expect(result.valid).toBe(false);
  });

  it("flags an unavailable (unregistered) Provider", () => {
    const result = stage.validate({ ...validInput(), providerAvailable: false });
    expect(result.valid).toBe(false);
  });

  it("does not require providerAvailable to be set", () => {
    const result = stage.validate(validInput());
    expect(result.valid).toBe(true);
  });
});

describe("Stage 8 — ConfigurationValidator", () => {
  const stage = new ConfigurationValidator();
  const baseConfig = {
    id: "cfg-1",
    configurationId: "cfg-1",
    generationId: "g-1",
    custom: {},
    createdAt: now,
  };

  it("passes when no Configuration is present", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("passes a valid Configuration", () => {
    const result = stage.validate({
      ...validInput(),
      configuration: { ...baseConfig, maxTokens: 100, temperature: 0.7, timeoutMs: 5000 },
    });
    expect(result.valid).toBe(true);
  });

  it("flags a non-positive maxTokens", () => {
    const result = stage.validate({
      ...validInput(),
      configuration: { ...baseConfig, maxTokens: 0 },
    });
    expect(result.valid).toBe(false);
  });

  it("flags an out-of-range temperature", () => {
    const result = stage.validate({
      ...validInput(),
      configuration: { ...baseConfig, temperature: 3 },
    });
    expect(result.valid).toBe(false);
  });

  it("flags a non-positive timeoutMs", () => {
    const result = stage.validate({
      ...validInput(),
      configuration: { ...baseConfig, timeoutMs: -1 },
    });
    expect(result.valid).toBe(false);
  });
});

describe("Stage 9 — LifecycleValidator", () => {
  const stage = new LifecycleValidator();

  it("passes when no states are supplied", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("passes a legal transition", () => {
    const result = stage.validate({
      ...validInput(),
      currentState: KnowledgeGenerationState.DRAFT,
      targetState: KnowledgeGenerationState.QUEUED,
    });
    expect(result.valid).toBe(true);
  });

  it("passes a no-op transition (current === target)", () => {
    const result = stage.validate({
      ...validInput(),
      currentState: KnowledgeGenerationState.DRAFT,
      targetState: KnowledgeGenerationState.DRAFT,
    });
    expect(result.valid).toBe(true);
  });

  it("flags an illegal transition", () => {
    const result = stage.validate({
      ...validInput(),
      currentState: KnowledgeGenerationState.DRAFT,
      targetState: KnowledgeGenerationState.COMPLETED,
    });
    expect(result.valid).toBe(false);
  });
});

describe("Stage 10 — DependencyValidator", () => {
  const stage = new DependencyValidator();

  it("passes when a non-Custom Mode declares a Prompt Reference", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("flags a non-Custom Mode with no Prompt Reference", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: { ...input.request, promptReferenceId: undefined },
    });
    expect(result.valid).toBe(false);
  });

  it("passes a Custom Mode with no Prompt Reference", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      request: {
        ...input.request,
        mode: KnowledgeGenerationMode.CUSTOM,
        promptReferenceId: undefined,
      },
    });
    expect(result.valid).toBe(true);
  });

  it("flags a Policy requiring approval with no Configuration", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      policy: {
        id: "policy-1",
        policyId: "policy-1",
        name: "Policy",
        tenantId: "tenant-1",
        allowedAssetTypes: [],
        allowedProviderTypes: [],
        allowedModes: [],
        requireApproval: true,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    });
    expect(result.valid).toBe(false);
  });
});

describe("Stage 11 — IntegrityValidator", () => {
  const stage = new IntegrityValidator();

  it("passes matching tenantId across Metadata/Context", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("flags mismatched tenantId between Context and Metadata", () => {
    const input = validInput();
    const result = stage.validate({ ...input, context: { ...input.context, tenantId: "other" } });
    expect(result.valid).toBe(false);
  });

  it("flags mismatched Configuration providerType vs Request providerType", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      configuration: {
        id: "cfg-1",
        configurationId: "cfg-1",
        generationId: "g-1",
        providerType: KnowledgeGenerationProviderType.CLAUDE,
        custom: {},
        createdAt: now,
      },
    });
    expect(result.valid).toBe(false);
  });

  it("passes matching Configuration providerType", () => {
    const input = validInput();
    const result = stage.validate({
      ...input,
      configuration: {
        id: "cfg-1",
        configurationId: "cfg-1",
        generationId: "g-1",
        providerType: KnowledgeGenerationProviderType.OPENAI,
        custom: {},
        createdAt: now,
      },
    });
    expect(result.valid).toBe(true);
  });
});

describe("Stage 12 — AuditValidator", () => {
  const stage = new AuditValidator();

  it("passes a well-formed audit actor/timestamp", () => {
    expect(stage.validate(validInput()).valid).toBe(true);
  });

  it("flags a blank requestedBy", () => {
    const input = validInput();
    expect(stage.validate({ ...input, request: { ...input.request, requestedBy: "" } }).valid).toBe(
      false,
    );
  });

  it("flags a malformed request.createdAt", () => {
    const input = validInput();
    expect(
      stage.validate({ ...input, request: { ...input.request, createdAt: "not-a-date" } }).valid,
    ).toBe(false);
  });
});
