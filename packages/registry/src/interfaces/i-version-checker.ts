/** Port for version compatibility / breaking-change detection (wraps `semver`). */
export interface IVersionChecker {
  isCompatible(version: string, range: string): boolean;
  compare(a: string, b: string): -1 | 0 | 1;
  isBreakingChange(fromVersion: string, toVersion: string): boolean;
}
