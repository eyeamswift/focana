#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

info() { printf '\033[1;34m[ship-safe]\033[0m %s\n' "$1"; }
ok() { printf '\033[1;32m[ship-safe]\033[0m %s\n' "$1"; }

cd "$PROJECT_ROOT"

info "Step 1/3: Running packaged smoke checks"
./scripts/ship-smoke.sh
ok "Packaged smoke checks passed"

info "Step 2/3: Rehearsing the full release flow"
./scripts/ship.sh --dry-run
ok "Dry run passed"

info "Step 3/3: Publishing with existing smoke-tested artifacts"
./scripts/ship.sh --skip-build
ok "Release flow complete"
