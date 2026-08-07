import { KnowledgeQualityException } from "./knowledge-quality-exception.js";

/** Thrown when `KnowledgeQualityRegistry.register()` is called with an id already present in the target bucket. */
export class DuplicateQualityEntryException extends KnowledgeQualityException {}
