import { KnowledgeIntelligenceException } from "./knowledge-intelligence-exception.js";

export class SnapshotNotFoundException extends KnowledgeIntelligenceException {
  constructor(snapshotId: string) {
    super(`Knowledge intelligence snapshot not found: ${snapshotId}`, {
      code: "SNAPSHOT_NOT_FOUND",
      context: { snapshotId },
    });
  }
}
