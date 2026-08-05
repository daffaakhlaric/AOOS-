import {
  EMPTY_KNOWLEDGE_RUNTIME_METADATA,
  type KnowledgeRuntimeMetadata,
} from "../domain/knowledge-runtime-metadata.js";

export interface CreateRuntimeMetadataInput {
  readonly createdBy?: string;
  readonly reason?: string;
  readonly source?: string;
  readonly labels?: readonly string[];
  readonly custom?: Readonly<Record<string, unknown>>;
}

export class RuntimeMetadataFactory {
  create(input: CreateRuntimeMetadataInput = {}): KnowledgeRuntimeMetadata {
    return {
      ...EMPTY_KNOWLEDGE_RUNTIME_METADATA,
      createdBy: input.createdBy,
      reason: input.reason,
      source: input.source,
      labels: [...(input.labels ?? [])],
      custom: { ...input.custom },
    };
  }
}
