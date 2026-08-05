import {
  KnowledgeSourceException,
  type KnowledgeSourceExceptionOptions,
} from "./knowledge-source-exception.js";

/** Thrown when a lookup references a `KnowledgeSourceCategory` value that isn't registered in the `CATEGORY` bucket. */
export class SourceCategoryNotFoundException extends KnowledgeSourceException {
  constructor(message: string, options: KnowledgeSourceExceptionOptions = {}) {
    super(message, options);
  }
}
