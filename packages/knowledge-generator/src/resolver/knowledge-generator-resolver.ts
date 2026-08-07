import type { KnowledgeGenerationContext } from "../domain/knowledge-generation-context.js";
import type { KnowledgeGenerationPolicy } from "../domain/knowledge-generation-policy.js";
import type { KnowledgeGenerationPromptReference } from "../domain/knowledge-generation-prompt-reference.js";
import type { KnowledgeGenerationSession } from "../domain/knowledge-generation-session.js";
import type { KnowledgeGeneration } from "../domain/knowledge-generation.js";
import { GeneratorNotFoundException } from "../errors/generator-not-found-exception.js";
import { KnowledgeGeneratorRegistryBucket } from "../registry/knowledge-generator-registry-bucket.js";
import type { KnowledgeGeneratorRegistry } from "../registry/knowledge-generator-registry.js";

/**
 * "RESOLVER: Generation Resolver, Prompt Resolver, Context Resolver, Policy Resolver,
 * Session Resolver." (docs/PROMPT-005.7K-KNOWLEDGE-GENERATOR.md) — the exact 5
 * resolution dimensions, implemented as 5 method pairs on one class. Every resolve is a
 * direct Registry bucket lookup by id — "Never scan collections."
 */
export class KnowledgeGeneratorResolver {
  constructor(private readonly registry: KnowledgeGeneratorRegistry) {}

  /* ---- 1. Generation Resolver ---- */
  resolveGeneration(generationId: string): KnowledgeGeneration {
    const entry = this.tryResolveGeneration(generationId);
    if (!entry) {
      throw new GeneratorNotFoundException(
        `No Generation is registered for Generation Id "${generationId}"`,
      );
    }
    return entry;
  }

  tryResolveGeneration(generationId: string): KnowledgeGeneration | undefined {
    return this.registry.get<KnowledgeGeneration>(
      KnowledgeGeneratorRegistryBucket.GENERATION,
      generationId,
    );
  }

  /* ---- 2. Prompt Resolver ---- */
  resolvePrompt(promptId: string): KnowledgeGenerationPromptReference {
    const entry = this.tryResolvePrompt(promptId);
    if (!entry) {
      throw new GeneratorNotFoundException(
        `No Prompt Reference is registered for Prompt Id "${promptId}"`,
      );
    }
    return entry;
  }

  tryResolvePrompt(promptId: string): KnowledgeGenerationPromptReference | undefined {
    return this.registry.get<KnowledgeGenerationPromptReference>(
      KnowledgeGeneratorRegistryBucket.PROMPT,
      promptId,
    );
  }

  /* ---- 3. Context Resolver ---- */
  resolveContext(contextId: string): KnowledgeGenerationContext {
    const entry = this.tryResolveContext(contextId);
    if (!entry) {
      throw new GeneratorNotFoundException(
        `No Context Reference is registered for Context Id "${contextId}"`,
      );
    }
    return entry;
  }

  tryResolveContext(contextId: string): KnowledgeGenerationContext | undefined {
    return this.registry.get<KnowledgeGenerationContext>(
      KnowledgeGeneratorRegistryBucket.CONTEXT,
      contextId,
    );
  }

  /* ---- 4. Policy Resolver ---- */
  resolvePolicy(policyId: string): KnowledgeGenerationPolicy {
    const entry = this.tryResolvePolicy(policyId);
    if (!entry) {
      throw new GeneratorNotFoundException(`No Policy is registered for Policy Id "${policyId}"`);
    }
    return entry;
  }

  tryResolvePolicy(policyId: string): KnowledgeGenerationPolicy | undefined {
    return this.registry.get<KnowledgeGenerationPolicy>(
      KnowledgeGeneratorRegistryBucket.POLICY,
      policyId,
    );
  }

  /* ---- 5. Session Resolver ---- */
  resolveSession(sessionId: string): KnowledgeGenerationSession {
    const entry = this.tryResolveSession(sessionId);
    if (!entry) {
      throw new GeneratorNotFoundException(
        `No Generation Session is registered for Session Id "${sessionId}"`,
      );
    }
    return entry;
  }

  tryResolveSession(sessionId: string): KnowledgeGenerationSession | undefined {
    return this.registry.get<KnowledgeGenerationSession>(
      KnowledgeGeneratorRegistryBucket.SESSION,
      sessionId,
    );
  }
}
