import { KnowledgeGraphException } from "./knowledge-graph-exception.js";

/** Thrown when a Registry `register()` call collides with an existing id in the same bucket. */
export class DuplicateEntryException extends KnowledgeGraphException {
  constructor(bucket: string, id: string) {
    super(`Duplicate entry in ${bucket} registry: ${id}`, {
      code: "DUPLICATE_ENTRY",
      context: { bucket, id },
    });
  }
}
