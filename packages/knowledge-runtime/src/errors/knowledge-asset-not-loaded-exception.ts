import {
  KnowledgeRuntimeException,
  type KnowledgeRuntimeExceptionOptions,
} from "./knowledge-runtime-exception.js";

/** Thrown by `KnowledgeRuntimeLoader` when the referenced `KnowledgeAsset` cannot be read from the Knowledge Registry/Repository/Catalog (read-only). */
export class KnowledgeAssetNotLoadedException extends KnowledgeRuntimeException {
  constructor(message: string, options: KnowledgeRuntimeExceptionOptions = {}) {
    super(message, options);
  }
}
