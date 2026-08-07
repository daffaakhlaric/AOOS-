import { KnowledgeQualityException } from "./knowledge-quality-exception.js";

/** Thrown by `KnowledgeQualitySession` when an operation is attempted against a Session in an incompatible state. */
export class QualitySessionException extends KnowledgeQualityException {}
