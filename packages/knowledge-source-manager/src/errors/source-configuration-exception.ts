import {
  KnowledgeSourceException,
  type KnowledgeSourceExceptionOptions,
} from "./knowledge-source-exception.js";

/** Thrown by `KnowledgeSourceConfiguration#assertValid()` when a Source's configuration violates an enforced rule (e.g. Auto Sync without Enabled, secret-looking keys, an incomplete Schedule descriptor). */
export class SourceConfigurationException extends KnowledgeSourceException {
  constructor(message: string, options: KnowledgeSourceExceptionOptions = {}) {
    super(message, options);
  }
}
