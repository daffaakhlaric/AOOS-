#!/usr/bin/env bash
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pnpm exec prettier --write "**/*.{ts,tsx,js,cjs,mjs,json,md,yml,yaml}" --ignore-path .prettierignore
