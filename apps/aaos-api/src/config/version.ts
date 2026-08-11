import { createRequire } from "node:module";

/**
 * Reads this app's own `package.json` `version` field at startup, for `GET /health`'s response.
 * Uses `createRequire` (works for JSON under ESM without import-attribute syntax, which varies
 * across the Node.js versions this monorepo targets) rather than a static `import ... assert`.
 * Path is relative to this file's own location, two directories up from either `src/config/` (when
 * running under Vitest/ts-node directly) or the identically-shaped `dist/config/` (after `tsc -b`)
 * — both resolve to the app root's `package.json`.
 */
export function readAppVersion(): string {
  const require = createRequire(import.meta.url);
  const pkg = require("../../package.json") as { readonly version: string };
  return pkg.version;
}
