import { KnowledgeUpdateType } from "../types/update-type.js";

import type { ChangeDetectionResult } from "./knowledge-update-detector.js";

/**
 * Decides WHICH of the 13 supported update types applies given a `KnowledgeUpdateDetector`
 * result. Only decides between the "change-driven" types (Version/Full/Incremental/Metadata/
 * Refresh) — the remaining types (Manual/Scheduled/Synchronization/Policy/Dependency/Recovery/
 * Retry/Emergency) are explicit caller/context intents, not something inferred from a diff, so
 * callers pass those directly to the job factory instead of through this engine.
 */
export class KnowledgeUpdateDecisionEngine {
  decide(detection: ChangeDetectionResult): KnowledgeUpdateType | undefined {
    if (!detection.changed) return undefined;

    const reasons = new Set(detection.reasons);
    if (reasons.has("version_changed") || reasons.has("version_added")) {
      return KnowledgeUpdateType.Version;
    }
    if (reasons.has("checksum_changed") && reasons.has("extra_metadata_changed")) {
      return KnowledgeUpdateType.Full;
    }
    if (reasons.has("checksum_changed")) {
      return KnowledgeUpdateType.Incremental;
    }
    if (reasons.has("extra_metadata_changed")) {
      return KnowledgeUpdateType.Metadata;
    }
    if (reasons.has("last_modified_advanced")) {
      return KnowledgeUpdateType.Refresh;
    }
    return KnowledgeUpdateType.Manual;
  }
}
