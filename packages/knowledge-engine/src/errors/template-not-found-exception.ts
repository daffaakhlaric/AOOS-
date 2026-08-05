import { KnowledgeException, type KnowledgeExceptionOptions } from "./knowledge-exception.js";

/** Thrown by `template/knowledge-template-engine.ts` when the requested `KnowledgeTemplate` id is not registered. */
export class TemplateNotFoundException extends KnowledgeException {
  constructor(message: string, options: KnowledgeExceptionOptions = {}) {
    super(message, options);
  }
}
