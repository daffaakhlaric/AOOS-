import { createKnowledgeVersion, type KnowledgeVersion } from "../domain/knowledge-version.js";

export interface CreateVersionInput {
  readonly major?: number;
  readonly minor?: number;
  readonly patch?: number;
  readonly createdBy?: string;
}

/** Builds a fresh `KnowledgeVersion` — defaults to `1.0.0` when no components are supplied. Version *bumping* over an existing History belongs to `version/knowledge-version-engine.ts`. */
export class VersionFactory {
  create(input: CreateVersionInput = {}): KnowledgeVersion {
    return createKnowledgeVersion(input);
  }
}
