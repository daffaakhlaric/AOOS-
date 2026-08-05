import {
  KnowledgeSourceException,
  type KnowledgeSourceExceptionOptions,
} from "./knowledge-source-exception.js";

/** Thrown when `KnowledgeSourceRegistry`/`KnowledgeSourceManager` has no entry registered for a given id/bucket/token. */
export class SourceNotFoundException extends KnowledgeSourceException {
  constructor(message: string, options: KnowledgeSourceExceptionOptions = {}) {
    super(message, options);
  }
}
