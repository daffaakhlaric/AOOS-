import type { Metadata } from "../types/common.js";

export interface AssetMetadataSnapshot {
  readonly version?: string;
  readonly checksum?: string;
  readonly lastModifiedAt?: number;
  readonly extra?: Metadata;
}

export interface ChangeDetectionResult {
  readonly changed: boolean;
  readonly reasons: readonly string[];
}

/**
 * Real change-detection: compares two caller-supplied metadata snapshots of a knowledge asset
 * (version, checksum/hash-like field, last-modified timestamp) and reports whether — and why —
 * an update is needed. This package never touches real asset content; callers supply the
 * snapshots.
 */
export class KnowledgeUpdateDetector {
  detect(previous: AssetMetadataSnapshot, current: AssetMetadataSnapshot): ChangeDetectionResult {
    const reasons: string[] = [];

    if (previous.version !== undefined && current.version !== undefined) {
      if (previous.version !== current.version) reasons.push("version_changed");
    } else if (current.version !== undefined && previous.version === undefined) {
      reasons.push("version_added");
    }

    if (previous.checksum !== undefined && current.checksum !== undefined) {
      if (previous.checksum !== current.checksum) reasons.push("checksum_changed");
    } else if (current.checksum !== undefined && previous.checksum === undefined) {
      reasons.push("checksum_added");
    }

    if (
      previous.lastModifiedAt !== undefined &&
      current.lastModifiedAt !== undefined &&
      current.lastModifiedAt > previous.lastModifiedAt
    ) {
      reasons.push("last_modified_advanced");
    }

    if (this.extraChanged(previous.extra, current.extra)) {
      reasons.push("extra_metadata_changed");
    }

    return { changed: reasons.length > 0, reasons };
  }

  private extraChanged(previous: Metadata | undefined, current: Metadata | undefined): boolean {
    if (previous === undefined && current === undefined) return false;
    if (previous === undefined || current === undefined) return true;
    const previousKeys = Object.keys(previous);
    const currentKeys = Object.keys(current);
    if (previousKeys.length !== currentKeys.length) return true;
    return currentKeys.some((key) => previous[key] !== current[key]);
  }
}
