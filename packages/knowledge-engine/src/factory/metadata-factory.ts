import type { KnowledgeClassification } from "../domain/knowledge-classification.js";
import type { KnowledgeMetadata } from "../domain/knowledge-metadata.js";

export interface CreateMetadataInput {
  readonly author?: string;
  readonly department?: string;
  readonly owner?: string;
  readonly tenant?: string;
  readonly workspace?: string;
  readonly language?: string;
  readonly region?: string;
  readonly industry?: string;
  readonly tags?: readonly string[];
  readonly keywords?: readonly string[];
  readonly source?: string;
  readonly confidence?: number;
  readonly classification: KnowledgeClassification;
  readonly priority?: number;
  readonly custom?: Readonly<Record<string, unknown>>;
}

/** Builds a fresh `KnowledgeMetadata` — `createdAt`/`updatedAt` are stamped to the same "now" instant. */
export class MetadataFactory {
  create(input: CreateMetadataInput): KnowledgeMetadata {
    const now = new Date().toISOString();
    return {
      author: input.author,
      department: input.department,
      owner: input.owner,
      tenant: input.tenant,
      workspace: input.workspace,
      language: input.language,
      region: input.region,
      industry: input.industry,
      tags: [...(input.tags ?? [])],
      keywords: [...(input.keywords ?? [])],
      createdAt: now,
      updatedAt: now,
      source: input.source,
      confidence: input.confidence,
      classification: input.classification,
      priority: input.priority,
      custom: { ...input.custom },
    };
  }
}
