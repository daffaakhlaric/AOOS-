import { KnowledgeQualityException } from "./knowledge-quality-exception.js";

/** Thrown when a `KnowledgeQuality` facade operation cannot be completed against its current inputs. */
export class QualityOperationException extends KnowledgeQualityException {}
