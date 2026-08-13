#!/usr/bin/env node
/**
 * Wrapper invoked by lint-staged for `*.{ts,tsx}` files.
 *
 * Why this exists: `@aos/eslint-config` (configs/eslint-config/index.cjs) sets
 * `parserOptions.tsconfigRootDir: process.cwd()` so each package's own `tsconfig.eslint.json`
 * resolves correctly — but that only works when ESLint is invoked with its CWD set to the
 * package being linted. `pnpm -w lint` (via Turbo) does this correctly per package. lint-staged,
 * however, invokes `eslint --fix <files>` once from the repo root regardless of which package(s)
 * the staged files belong to, so `tsconfigRootDir` resolves to the repo root for every file and
 * ESLint fails with "Cannot read file '<repo root>/tsconfig.eslint.json'" for any package other
 * than one literally at the repo root.
 *
 * Fix: group the staged files by their nearest package root (the first ancestor directory that
 * has both `package.json` and an ESLint config — `.eslintrc.cjs` for backend packages, or
 * `.eslintrc.json` for the Next.js apps, which use that extension by Next.js's own convention),
 * then run `eslint --fix` once per group with `cwd` set to that package root — mirroring exactly
 * how `pnpm -w lint` already runs cleanly.
 */
"use strict";

const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const files = process.argv.slice(2);

if (files.length === 0) {
  process.exit(0);
}

function findPackageRoot(filePath) {
  let dir = path.dirname(path.resolve(filePath));
  while (dir.startsWith(repoRoot)) {
    const hasPackageJson = fs.existsSync(path.join(dir, "package.json"));
    const hasEslintrc =
      fs.existsSync(path.join(dir, ".eslintrc.cjs")) ||
      fs.existsSync(path.join(dir, ".eslintrc.json"));
    if (hasPackageJson && hasEslintrc) {
      return dir;
    }
    if (dir === repoRoot) {
      break;
    }
    dir = path.dirname(dir);
  }
  return repoRoot;
}

const groups = new Map();
for (const file of files) {
  const pkgRoot = findPackageRoot(file);
  const relFile = path.relative(pkgRoot, path.resolve(file));
  if (!groups.has(pkgRoot)) {
    groups.set(pkgRoot, []);
  }
  groups.get(pkgRoot).push(relFile);
}

let failed = false;

for (const [pkgRoot, relFiles] of groups) {
  const result = spawnSync("npx", ["eslint", "--fix", ...relFiles], {
    cwd: pkgRoot,
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) {
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
