import { ChangeMagnitude } from "../types/change-magnitude.js";

import type { ChangeDetectionResult } from "./knowledge-update-detector.js";

/**
 * Classifies the nature/magnitude of a detected change given the detector's reasons list.
 * Structural (version change) > Content (checksum change) > MetadataOnly (extra/other) > None.
 */
export class KnowledgeChangeAnalyzer {
  classify(detection: ChangeDetectionResult): ChangeMagnitude {
    if (!detection.changed) return ChangeMagnitude.None;
    const reasons = new Set(detection.reasons);
    if (reasons.has("version_changed") || reasons.has("version_added")) {
      return ChangeMagnitude.Structural;
    }
    if (reasons.has("checksum_changed")) {
      return ChangeMagnitude.Content;
    }
    return ChangeMagnitude.MetadataOnly;
  }
}
