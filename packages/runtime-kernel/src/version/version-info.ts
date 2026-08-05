/**
 * Kept in sync with package.json's "version" field by hand (Foundation-phase choice — reading
 * package.json at runtime via import assertions is avoided here to keep dist/ output free of
 * a relative-path dependency on the source tree's package.json after build).
 */
export const KERNEL_VERSION = "0.1.0";

export function getUptimeMs(startedAt: Date): number {
  return Date.now() - startedAt.getTime();
}
