import type { KnowledgeGenerationAssetType } from "../domain/knowledge-generation-asset-type.js";
import type { KnowledgeGenerationMetadata } from "../domain/knowledge-generation-metadata.js";
import type { KnowledgeGenerationMode } from "../domain/knowledge-generation-mode.js";
import type { KnowledgeGenerationPromptReference } from "../domain/knowledge-generation-prompt-reference.js";
import type { KnowledgeGenerationProviderType } from "../domain/knowledge-generation-provider-type.js";
import type { KnowledgeGenerationRequest } from "../domain/knowledge-generation-request.js";
import type { KnowledgeGenerationResult } from "../domain/knowledge-generation-result.js";
import type { KnowledgeGenerationSession } from "../domain/knowledge-generation-session.js";
import { KnowledgeGenerationState } from "../domain/knowledge-generation-state.js";
import type { KnowledgeGeneration } from "../domain/knowledge-generation.js";
import { KnowledgeGeneratorSessionState } from "../domain/knowledge-generator-session-state.js";
import { generateId } from "../utils/id.js";

/** "GenerationFactory" (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md — "Factory") — creates `KnowledgeGeneration` instance envelopes. */
class GenerationFactory {
  create(input: {
    token: string;
    generationId: string;
    tenantId: string;
    workspaceId?: string;
  }): KnowledgeGeneration {
    const now = new Date().toISOString();
    return {
      id: input.generationId,
      token: input.token,
      generationId: input.generationId,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      state: KnowledgeGenerationState.DRAFT,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/** "RequestFactory" — creates `KnowledgeGenerationRequest` records. */
class RequestFactory {
  create(input: {
    generationId: string;
    assetType: KnowledgeGenerationAssetType;
    mode: KnowledgeGenerationMode;
    providerType: KnowledgeGenerationProviderType;
    requestedBy: string;
    promptReferenceId?: string;
    contextReferenceId?: string;
    policyId?: string;
    configurationId?: string;
    instructions?: string;
  }): KnowledgeGenerationRequest {
    return {
      id: generateId(),
      requestId: generateId(),
      generationId: input.generationId,
      assetType: input.assetType,
      mode: input.mode,
      providerType: input.providerType,
      promptReferenceId: input.promptReferenceId,
      contextReferenceId: input.contextReferenceId,
      policyId: input.policyId,
      configurationId: input.configurationId,
      requestedBy: input.requestedBy,
      instructions: input.instructions,
      createdAt: new Date().toISOString(),
    };
  }
}

/** "ResultFactory" — creates `KnowledgeGenerationResult` metadata records (never the generated content itself). */
class ResultFactory {
  create(input: {
    generationId: string;
    providerId: string;
    providerType: KnowledgeGenerationProviderType;
    contentLocation?: string;
    summary?: string;
    outputMetadata?: Readonly<Record<string, unknown>>;
  }): KnowledgeGenerationResult {
    return {
      id: generateId(),
      resultId: generateId(),
      generationId: input.generationId,
      providerId: input.providerId,
      providerType: input.providerType,
      contentLocation: input.contentLocation,
      summary: input.summary,
      outputMetadata: { ...input.outputMetadata },
      completedAt: new Date().toISOString(),
    };
  }
}

/** "SessionFactory" — creates `KnowledgeGenerationSession` domain records. */
class SessionFactory {
  create(input: {
    generationId: string;
    tenantId: string;
    holder: string;
    ttlMs?: number;
  }): KnowledgeGenerationSession {
    const now = new Date();
    return {
      id: generateId(),
      sessionId: generateId(),
      generationId: input.generationId,
      tenantId: input.tenantId,
      holder: input.holder,
      state: KnowledgeGeneratorSessionState.OPEN,
      openedAt: now.toISOString(),
      expiresAt: input.ttlMs ? new Date(now.getTime() + input.ttlMs).toISOString() : undefined,
    };
  }
}

/** "PromptFactory" — creates `KnowledgeGenerationPromptReference` records (a pointer, never the prompt text). */
class PromptFactory {
  create(input: {
    promptId: string;
    promptVersion: string;
    namespace: string;
    description?: string;
  }): KnowledgeGenerationPromptReference {
    return {
      id: input.promptId,
      promptId: input.promptId,
      promptVersion: input.promptVersion,
      namespace: input.namespace,
      description: input.description,
      createdAt: new Date().toISOString(),
    };
  }
}

/** "MetadataFactory" — creates `KnowledgeGenerationMetadata` records. */
class MetadataFactory {
  create(input: {
    generationId: string;
    title: string;
    tenantId: string;
    description?: string;
    workspaceId?: string;
    tags?: readonly string[];
    createdBy?: string;
  }): KnowledgeGenerationMetadata {
    const now = new Date().toISOString();
    return {
      generationId: input.generationId,
      title: input.title,
      description: input.description,
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      tags: [...(input.tags ?? [])],
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
  }
}

/**
 * "FACTORY: Generation Factory, Request Factory, Result Factory, Session Factory,
 * Prompt Factory, Metadata Factory." (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md) —
 * "KnowledgeGeneratorFactory" composes the 6 named sub-factories as `readonly` fields.
 */
export class KnowledgeGeneratorFactory {
  readonly generation = new GenerationFactory();
  readonly request = new RequestFactory();
  readonly result = new ResultFactory();
  readonly session = new SessionFactory();
  readonly prompt = new PromptFactory();
  readonly metadata = new MetadataFactory();
}
