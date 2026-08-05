import semver from "semver";

import { KernelException } from "../errors/index.js";

/**
 * Version compatibility checking for Modules/Plugins declaring a required Kernel version
 * range, or for comparing two arbitrary semver strings. Uses the `semver` package rather than
 * hand-rolled parsing (documented reason: correctness of version-range comparison is
 * compatibility-critical, and `semver` is the de facto standard, dependency-free, MIT-licensed
 * implementation — see docs/005.2-CORE-RUNTIME-KERNEL-REPORT.md for the full dependency justification).
 */
export function isVersionCompatible(version: string, range: string): boolean {
  if (!semver.valid(version)) {
    throw new KernelException(`"${version}" is not a valid semantic version`);
  }
  if (!semver.validRange(range)) {
    throw new KernelException(`"${range}" is not a valid semver range`);
  }
  return semver.satisfies(version, range);
}

/** -1 if a < b, 0 if equal, 1 if a > b. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  return semver.compare(a, b) as -1 | 0 | 1;
}
