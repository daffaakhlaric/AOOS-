import { describe, expect, it } from "vitest";

import { KnowledgeGenerationAssetType } from "../../src/domain/knowledge-generation-asset-type.js";
import { knowledgeGenerationAuditSchema } from "../../src/domain/knowledge-generation-audit.js";
import { knowledgeGenerationConfigurationSchema } from "../../src/domain/knowledge-generation-configuration.js";
import { knowledgeGenerationContextSchema } from "../../src/domain/knowledge-generation-context.js";
import { knowledgeGenerationJobSchema } from "../../src/domain/knowledge-generation-job.js";
import { knowledgeGenerationMetadataSchema } from "../../src/domain/knowledge-generation-metadata.js";
import { KnowledgeGenerationMode } from "../../src/domain/knowledge-generation-mode.js";
import {
  evaluateKnowledgeGenerationPolicy,
  knowledgeGenerationPolicySchema,
} from "../../src/domain/knowledge-generation-policy.js";
import { knowledgeGenerationPromptReferenceSchema } from "../../src/domain/knowledge-generation-prompt-reference.js";
import { KnowledgeGenerationProviderType } from "../../src/domain/knowledge-generation-provider-type.js";
import { knowledgeGenerationRequestSchema } from "../../src/domain/knowledge-generation-request.js";
import { knowledgeGenerationResultSchema } from "../../src/domain/knowledge-generation-result.js";
import { knowledgeGenerationSessionSchema } from "../../src/domain/knowledge-generation-session.js";
import {
  KNOWLEDGE_GENERATION_SETTLED_STATES,
  KNOWLEDGE_GENERATION_STATE_TRANSITIONS,
  KNOWLEDGE_GENERATION_TERMINAL_STATES,
  KnowledgeGenerationState,
} from "../../src/domain/knowledge-generation-state.js";
import { EMPTY_KNOWLEDGE_GENERATION_STATISTICS } from "../../src/domain/knowledge-generation-statistics-snapshot.js";
import { knowledgeGenerationSchema } from "../../src/domain/knowledge-generation.js";
import { KnowledgeGeneratorSessionState } from "../../src/domain/knowledge-generator-session-state.js";

const now = new Date().toISOString();

describe("Knowledge Types (KnowledgeGenerationAssetType)", () => {
  it("has exactly 20 Knowledge Types", () => {
    expect(Object.values(KnowledgeGenerationAssetType)).toHaveLength(20);
  });
});

describe("Generation Providers (KnowledgeGenerationProviderType)", () => {
  it("has exactly 10 Generation Providers", () => {
    expect(Object.values(KnowledgeGenerationProviderType)).toHaveLength(10);
  });
});

describe("Generation Modes (KnowledgeGenerationMode)", () => {
  it("has exactly 12 Generation Modes", () => {
    expect(Object.values(KnowledgeGenerationMode)).toHaveLength(12);
  });
});

describe("Lifecycle (KnowledgeGenerationState)", () => {
  it("has exactly 10 states", () => {
    expect(Object.values(KnowledgeGenerationState)).toHaveLength(10);
  });

  it("Destroyed is the only terminal state", () => {
    expect(KNOWLEDGE_GENERATION_TERMINAL_STATES.size).toBe(1);
    expect(KNOWLEDGE_GENERATION_TERMINAL_STATES.has(KnowledgeGenerationState.DESTROYED)).toBe(true);
  });

  it("Destroyed has no outgoing edges", () => {
    expect(KNOWLEDGE_GENERATION_STATE_TRANSITIONS[KnowledgeGenerationState.DESTROYED]).toEqual([]);
  });

  it("every state is reachable from Draft", () => {
    const reachable = new Set<KnowledgeGenerationState>([KnowledgeGenerationState.DRAFT]);
    let frontier = [KnowledgeGenerationState.DRAFT];
    while (frontier.length > 0) {
      const next: KnowledgeGenerationState[] = [];
      for (const state of frontier) {
        for (const target of KNOWLEDGE_GENERATION_STATE_TRANSITIONS[state]) {
          if (!reachable.has(target)) {
            reachable.add(target);
            next.push(target);
          }
        }
      }
      frontier = next;
    }
    expect(reachable.size).toBe(Object.values(KnowledgeGenerationState).length);
  });

  it("every non-terminal state has at least one outgoing edge", () => {
    for (const state of Object.values(KnowledgeGenerationState)) {
      if (state === KnowledgeGenerationState.DESTROYED) {
        continue;
      }
      expect(KNOWLEDGE_GENERATION_STATE_TRANSITIONS[state].length).toBeGreaterThan(0);
    }
  });

  it("settled states include Completed/Cancelled/Failed/Archived/Destroyed", () => {
    expect(KNOWLEDGE_GENERATION_SETTLED_STATES.has(KnowledgeGenerationState.COMPLETED)).toBe(true);
    expect(KNOWLEDGE_GENERATION_SETTLED_STATES.has(KnowledgeGenerationState.CANCELLED)).toBe(true);
    expect(KNOWLEDGE_GENERATION_SETTLED_STATES.has(KnowledgeGenerationState.FAILED)).toBe(true);
    expect(KNOWLEDGE_GENERATION_SETTLED_STATES.has(KnowledgeGenerationState.ARCHIVED)).toBe(true);
    expect(KNOWLEDGE_GENERATION_SETTLED_STATES.has(KnowledgeGenerationState.DRAFT)).toBe(false);
  });
});

describe("KnowledgeGeneratorSessionState", () => {
  it("has exactly 4 states", () => {
    expect(Object.values(KnowledgeGeneratorSessionState)).toHaveLength(4);
  });
});

describe("KnowledgeGeneration schema", () => {
  it("parses a valid record", () => {
    const parsed = knowledgeGenerationSchema.parse({
      id: "g-1",
      token: "kgen_x",
      generationId: "g-1",
      tenantId: "tenant-1",
      state: KnowledgeGenerationState.DRAFT,
      createdAt: now,
      updatedAt: now,
    });
    expect(parsed.generationId).toBe("g-1");
  });

  it("rejects a missing generationId", () => {
    expect(() =>
      knowledgeGenerationSchema.parse({
        id: "g-1",
        token: "kgen_x",
        tenantId: "tenant-1",
        state: KnowledgeGenerationState.DRAFT,
        createdAt: now,
        updatedAt: now,
      }),
    ).toThrow();
  });
});

describe("KnowledgeGenerationJob schema", () => {
  it("parses a valid record with default priority", () => {
    const parsed = knowledgeGenerationJobSchema.parse({
      id: "j-1",
      jobId: "j-1",
      generationId: "g-1",
      tenantId: "tenant-1",
      createdAt: now,
    });
    expect(parsed.priority).toBe(5);
  });
});

describe("KnowledgeGenerationSession schema", () => {
  it("parses a valid record", () => {
    const parsed = knowledgeGenerationSessionSchema.parse({
      id: "s-1",
      sessionId: "s-1",
      generationId: "g-1",
      tenantId: "tenant-1",
      holder: "user-1",
      state: KnowledgeGeneratorSessionState.OPEN,
      openedAt: now,
    });
    expect(parsed.state).toBe(KnowledgeGeneratorSessionState.OPEN);
  });
});

describe("KnowledgeGenerationPromptReference schema", () => {
  it("parses a valid record", () => {
    const parsed = knowledgeGenerationPromptReferenceSchema.parse({
      id: "p-1",
      promptId: "p-1",
      promptVersion: "1.0.0",
      namespace: "default",
      createdAt: now,
    });
    expect(parsed.promptId).toBe("p-1");
  });
});

describe("KnowledgeGenerationContext schema", () => {
  it("parses a valid record", () => {
    const parsed = knowledgeGenerationContextSchema.parse({
      id: "c-1",
      contextId: "c-1",
      tenantId: "tenant-1",
      referenceData: {},
      createdAt: now,
    });
    expect(parsed.contextId).toBe("c-1");
  });
});

describe("KnowledgeGenerationRequest schema", () => {
  it("parses a valid record", () => {
    const parsed = knowledgeGenerationRequestSchema.parse({
      id: "r-1",
      requestId: "r-1",
      generationId: "g-1",
      assetType: KnowledgeGenerationAssetType.FAQ,
      mode: KnowledgeGenerationMode.CREATE,
      providerType: KnowledgeGenerationProviderType.OPENAI,
      requestedBy: "user-1",
      createdAt: now,
    });
    expect(parsed.assetType).toBe(KnowledgeGenerationAssetType.FAQ);
  });
});

describe("KnowledgeGenerationResult schema", () => {
  it("parses a valid record without generated content fields", () => {
    const parsed = knowledgeGenerationResultSchema.parse({
      id: "res-1",
      resultId: "res-1",
      generationId: "g-1",
      providerId: "provider-1",
      providerType: KnowledgeGenerationProviderType.CLAUDE,
      outputMetadata: { tokens: 128 },
      completedAt: now,
    });
    expect(parsed.outputMetadata).toEqual({ tokens: 128 });
  });
});

describe("KnowledgeGenerationMetadata schema", () => {
  it("parses a valid record", () => {
    const parsed = knowledgeGenerationMetadataSchema.parse({
      generationId: "g-1",
      title: "Title",
      tenantId: "tenant-1",
      tags: [],
      createdAt: now,
      updatedAt: now,
    });
    expect(parsed.title).toBe("Title");
  });
});

describe("KnowledgeGenerationConfiguration schema", () => {
  it("parses a valid record", () => {
    const parsed = knowledgeGenerationConfigurationSchema.parse({
      id: "cfg-1",
      configurationId: "cfg-1",
      generationId: "g-1",
      custom: {},
      createdAt: now,
    });
    expect(parsed.configurationId).toBe("cfg-1");
  });
});

describe("KnowledgeGenerationPolicy schema + evaluateKnowledgeGenerationPolicy", () => {
  const basePolicy = knowledgeGenerationPolicySchema.parse({
    id: "pol-1",
    policyId: "pol-1",
    name: "Policy",
    tenantId: "tenant-1",
    allowedAssetTypes: [],
    allowedProviderTypes: [],
    allowedModes: [],
    createdAt: now,
    updatedAt: now,
  });

  it("defaults active=true and requireApproval=false", () => {
    expect(basePolicy.active).toBe(true);
    expect(basePolicy.requireApproval).toBe(false);
  });

  it("allows everything when allow-lists are empty and Policy is active", () => {
    const result = evaluateKnowledgeGenerationPolicy(basePolicy, {
      assetType: KnowledgeGenerationAssetType.FAQ,
      mode: KnowledgeGenerationMode.CREATE,
      providerType: KnowledgeGenerationProviderType.OPENAI,
    });
    expect(result.allowed).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("denies everything when the Policy is inactive", () => {
    const result = evaluateKnowledgeGenerationPolicy(
      { ...basePolicy, active: false },
      {
        assetType: KnowledgeGenerationAssetType.FAQ,
        mode: KnowledgeGenerationMode.CREATE,
        providerType: KnowledgeGenerationProviderType.OPENAI,
      },
    );
    expect(result.allowed).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("denies an Asset Type outside the allow-list", () => {
    const result = evaluateKnowledgeGenerationPolicy(
      { ...basePolicy, allowedAssetTypes: [KnowledgeGenerationAssetType.SOP] },
      {
        assetType: KnowledgeGenerationAssetType.FAQ,
        mode: KnowledgeGenerationMode.CREATE,
        providerType: KnowledgeGenerationProviderType.OPENAI,
      },
    );
    expect(result.allowed).toBe(false);
  });

  it("denies a Generation Mode outside the allow-list", () => {
    const result = evaluateKnowledgeGenerationPolicy(
      { ...basePolicy, allowedModes: [KnowledgeGenerationMode.SUMMARIZE] },
      {
        assetType: KnowledgeGenerationAssetType.FAQ,
        mode: KnowledgeGenerationMode.CREATE,
        providerType: KnowledgeGenerationProviderType.OPENAI,
      },
    );
    expect(result.allowed).toBe(false);
  });

  it("denies a Provider Type outside the allow-list", () => {
    const result = evaluateKnowledgeGenerationPolicy(
      { ...basePolicy, allowedProviderTypes: [KnowledgeGenerationProviderType.CLAUDE] },
      {
        assetType: KnowledgeGenerationAssetType.FAQ,
        mode: KnowledgeGenerationMode.CREATE,
        providerType: KnowledgeGenerationProviderType.OPENAI,
      },
    );
    expect(result.allowed).toBe(false);
  });

  it("allows a Request matching a non-empty allow-list", () => {
    const result = evaluateKnowledgeGenerationPolicy(
      {
        ...basePolicy,
        allowedAssetTypes: [KnowledgeGenerationAssetType.FAQ],
        allowedModes: [KnowledgeGenerationMode.CREATE],
        allowedProviderTypes: [KnowledgeGenerationProviderType.OPENAI],
      },
      {
        assetType: KnowledgeGenerationAssetType.FAQ,
        mode: KnowledgeGenerationMode.CREATE,
        providerType: KnowledgeGenerationProviderType.OPENAI,
      },
    );
    expect(result.allowed).toBe(true);
  });
});

describe("KnowledgeGenerationAudit schema", () => {
  it("parses a valid record", () => {
    const parsed = knowledgeGenerationAuditSchema.parse({
      id: "a-1",
      auditId: "a-1",
      generationId: "g-1",
      tenantId: "tenant-1",
      operation: "create_generation",
      occurredAt: now,
    });
    expect(parsed.operation).toBe("create_generation");
  });
});

describe("KnowledgeGenerationStatisticsSnapshot", () => {
  it("EMPTY snapshot has zeroed counters", () => {
    expect(EMPTY_KNOWLEDGE_GENERATION_STATISTICS).toEqual({
      requestedCount: 0,
      completedCount: 0,
      failedCount: 0,
    });
  });
});
