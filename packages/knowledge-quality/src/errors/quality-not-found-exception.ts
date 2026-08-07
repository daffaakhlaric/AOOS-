import { KnowledgeQualityException } from "./knowledge-quality-exception.js";

/** Thrown when a Registry `require()`/Manager lookup finds no entry for the given id/token. */
export class QualityNotFoundException extends KnowledgeQualityException {}
