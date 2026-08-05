import {
  KnowledgeSourceException,
  type KnowledgeSourceExceptionOptions,
} from "./knowledge-source-exception.js";

/** Thrown when `KnowledgeSourceCatalog` is asked for a Source it has no catalog entry for. */
export class CatalogEntryNotFoundException extends KnowledgeSourceException {
  constructor(message: string, options: KnowledgeSourceExceptionOptions = {}) {
    super(message, options);
  }
}
