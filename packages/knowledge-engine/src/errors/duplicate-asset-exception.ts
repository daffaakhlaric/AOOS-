import { KnowledgeException, type KnowledgeExceptionOptions } from "./knowledge-exception.js";

/** Thrown by `repository/knowledge-repository.ts#save()` when a `KnowledgeAsset` with the same id/namespace already exists — use `update()` instead. */
export class DuplicateAssetException extends KnowledgeException {
  constructor(message: string, options: KnowledgeExceptionOptions = {}) {
    super(message, options);
  }
}
