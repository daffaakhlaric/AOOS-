#!/usr/bin/env bash
set -euo pipefail

# Removes every package's build output, coverage report, and Turborepo cache.
# Does NOT remove node_modules or docker volumes — see `pnpm clean:deep` note below.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Removing dist/, coverage/, .turbo/, and *.tsbuildinfo across the workspace..."
find . -type d \( -name dist -o -name coverage -o -name .turbo \) -not -path "*/node_modules/*" -prune -exec rm -rf {} +
find . -type f -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete

echo "==> Clean complete."
echo "    To also remove node_modules: find . -type d -name node_modules -prune -exec rm -rf {} +"
