import {
  KnowledgeSourceException,
  type KnowledgeSourceExceptionOptions,
} from "./knowledge-source-exception.js";

/** Thrown when a `KnowledgeSourceMetadataRecord` fails schema validation. */
export class InvalidSourceMetadataException extends KnowledgeSourceException {
  constructor(message: string, options: KnowledgeSourceExceptionOptions = {}) {
    super(message, options);
  }
}
