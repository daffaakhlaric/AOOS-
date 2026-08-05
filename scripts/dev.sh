#!/usr/bin/env bash
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# No `dev`-mode app exists yet in the Foundation phase (no Runtime/Dashboard has been built).
# This script is reserved so `pnpm dev` has a stable entry point once Engineering Task 005.2
# adds the first app under apps/. Until then it just runs Turborepo's `dev` pipeline, which
# will no-op (no package currently defines a `dev` script).
pnpm turbo run dev
