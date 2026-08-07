import { KnowledgeQualityException } from "./knowledge-quality-exception.js";

/** Thrown by `KnowledgeQualitySession.renew()` when the Session's lease has already expired. */
export class QualityLeaseException extends KnowledgeQualityException {}
