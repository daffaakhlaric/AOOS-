import semver from "semver";

/** Version Compatibility check for a dependency reference (e.g. "requires tool X ^1.0.0"). */
export function isVersionCompatible(actualVersion: string, requiredRange: string): boolean {
  if (!semver.valid(actualVersion) || !semver.validRange(requiredRange)) {
    return false;
  }
  return semver.satisfies(actualVersion, requiredRange);
}

/** Capability Check: does the provided capability set satisfy every required capability? */
export function hasRequiredCapabilities(
  providedCapabilities: readonly string[],
  requiredCapabilities: readonly string[],
): boolean {
  const provided = new Set(providedCapabilities);
  return requiredCapabilities.every((capability) => provided.has(capability));
}

/** The subset of required capabilities NOT present in the provided set — useful for error messages. */
export function missingCapabilities(
  providedCapabilities: readonly string[],
  requiredCapabilities: readonly string[],
): string[] {
  const provided = new Set(providedCapabilities);
  return requiredCapabilities.filter((capability) => !provided.has(capability));
}
