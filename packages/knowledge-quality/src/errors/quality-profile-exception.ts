import { KnowledgeQualityException } from "./knowledge-quality-exception.js";

/** Thrown by the Pipeline's Profile Resolution stage (Stage 3) when a declared `profileId` does not resolve against the Profile Registry bucket. */
export class QualityProfileException extends KnowledgeQualityException {}
