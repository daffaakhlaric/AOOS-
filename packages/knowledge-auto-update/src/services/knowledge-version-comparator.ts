import { compareVersions, isValidVersion } from "../utils/version.js";

/** Real semantic-version-like comparison service (thin, testable wrapper over `utils/version`). */
export class KnowledgeVersionComparator {
  compare(a: string, b: string): number {
    return compareVersions(a, b);
  }

  isNewer(candidate: string, baseline: string): boolean {
    return this.compare(candidate, baseline) > 0;
  }

  isCompatible(version: string, minVersion: string, maxVersion: string): boolean {
    return this.compare(version, minVersion) >= 0 && this.compare(version, maxVersion) <= 0;
  }

  isValid(version: string): boolean {
    return isValidVersion(version);
  }
}
