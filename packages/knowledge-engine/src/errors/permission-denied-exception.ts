import { KnowledgeException, type KnowledgeExceptionOptions } from "./knowledge-exception.js";

/** Thrown by `permission/knowledge-permission-engine.ts` when a `KnowledgeContext` fails a Role/Policy-based check. */
export class PermissionDeniedException extends KnowledgeException {
  constructor(message: string, options: KnowledgeExceptionOptions = {}) {
    super(message, options);
  }
}
