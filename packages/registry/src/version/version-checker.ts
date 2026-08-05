import semver from "semver";

import { VersionException } from "../errors/version-exception.js";
import type { IVersionChecker } from "../interfaces/i-version-checker.js";

/** Semantic Version compatibility, comparison, and breaking-change detection (docs/PROMPT-005.3-REGISTRY-SYSTEM.md). */
export class VersionChecker implements IVersionChecker {
  isCompatible(version: string, range: string): boolean {
    if (!semver.valid(version)) {
      throw new VersionException(`"${version}" is not a valid semantic version`);
    }
    if (!semver.validRange(range)) {
      throw new VersionException(`"${range}" is not a valid semver range`);
    }
    return semver.satisfies(version, range);
  }

  compare(a: string, b: string): -1 | 0 | 1 {
    return semver.compare(a, b) as -1 | 0 | 1;
  }

  /** A major-version bump is treated as a Breaking Change — the SemVer convention this platform follows. */
  isBreakingChange(fromVersion: string, toVersion: string): boolean {
    const from = semver.parse(fromVersion);
    const to = semver.parse(toVersion);
    if (!from || !to) {
      throw new VersionException(
        `Cannot compare "${fromVersion}" → "${toVersion}": invalid SemVer`,
      );
    }
    return to.major > from.major;
  }
}
