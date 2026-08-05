#!/usr/bin/env bash
set -euo pipefail

# One-time/repeatable local environment bootstrap for AOS Foundation.
# Usage: bash scripts/setup.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Checking pnpm..."
if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is not installed. Install it first: https://pnpm.io/installation" >&2
  exit 1
fi

echo "==> Installing workspace dependencies..."
pnpm install

echo "==> Building all packages (dependency-ordered via Turborepo)..."
pnpm build

echo "==> Setup complete. Next steps:"
echo "    docker compose -f docker/docker-compose.yml up -d   # start local infra"
echo "    pnpm test                                             # run the test suite"
