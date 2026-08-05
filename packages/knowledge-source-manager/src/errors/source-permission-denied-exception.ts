import {
  KnowledgeSourceException,
  type KnowledgeSourceExceptionOptions,
} from "./knowledge-source-exception.js";

/** Thrown by `KnowledgeSourcePipeline`'s Permission stage when `KnowledgeSourcePermission#check()` denies a Context. */
export class SourcePermissionDeniedException extends KnowledgeSourceException {
  constructor(message: string, options: KnowledgeSourceExceptionOptions = {}) {
    super(message, options);
  }
}
