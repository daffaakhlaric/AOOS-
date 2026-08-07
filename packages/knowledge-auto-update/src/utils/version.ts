/**
 * Real semantic-version-like comparator. Supports `MAJOR.MINOR.PATCH` numeric segments (any
 * number of dot-separated numeric segments is accepted, not just 3) plus an optional
 * `-prerelease` suffix compared lexically, where a version WITH a prerelease suffix is considered
 * LOWER precedence than the same numeric version WITHOUT one (matches SemVer's rule that
 * `1.0.0-alpha < 1.0.0`).
 */
export function compareVersions(a: string, b: string): number {
  const [aCore, aPre] = splitVersion(a);
  const [bCore, bPre] = splitVersion(b);

  const aParts = aCore.split(".").map(parseSegment);
  const bParts = bCore.split(".").map(parseSegment);
  const len = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < len; i++) {
    const av = aParts[i] ?? 0;
    const bv = bParts[i] ?? 0;
    if (av !== bv) return av < bv ? -1 : 1;
  }

  if (aPre === undefined && bPre === undefined) return 0;
  if (aPre === undefined) return 1;
  if (bPre === undefined) return -1;
  if (aPre === bPre) return 0;
  return aPre < bPre ? -1 : 1;
}

export function isValidVersion(value: string): boolean {
  const [core] = splitVersion(value);
  if (core.length === 0) return false;
  return core.split(".").every((segment) => /^\d+$/.test(segment));
}

function splitVersion(value: string): [string, string | undefined] {
  const dashIndex = value.indexOf("-");
  if (dashIndex === -1) return [value, undefined];
  return [value.slice(0, dashIndex), value.slice(dashIndex + 1)];
}

function parseSegment(segment: string): number {
  if (!/^\d+$/.test(segment)) {
    throw new TypeError(`compareVersions: invalid numeric segment "${segment}"`);
  }
  return Number(segment);
}
