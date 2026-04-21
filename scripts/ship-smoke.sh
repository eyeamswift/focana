#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RELEASE_DIR="$PROJECT_ROOT/release"
RELEASE_NOTES_SCRIPT="$PROJECT_ROOT/scripts/release-notes.js"

SKIP_BUILD=false
DRY_RUN=false

info() { printf '\033[1;34m[ship-smoke]\033[0m %s\n' "$1"; }
ok() { printf '\033[1;32m[ship-smoke]\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m[ship-smoke]\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31m[ship-smoke]\033[0m %s\n' "$1" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: ./scripts/ship-smoke.sh [--skip-build] [--dry-run]

  --skip-build  Reuse existing release artifacts instead of rebuilding them
  --dry-run     Print the smoke-release steps without making changes

This script intentionally stops before tagging, publishing, or deploying.
It:
  1. Builds the mac release artifacts
  2. Verifies local artifacts and stapled DMGs
  3. Mounts the host-arch DMG and runs packaged-app smoke checks
EOF
}

for arg in "$@"; do
  case "$arg" in
    --skip-build)
      SKIP_BUILD=true
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "Unknown argument: $arg"
      ;;
  esac
done

require_tool() {
  local tool="$1"
  command -v "$tool" >/dev/null 2>&1 || fail "Missing required tool: $tool"
}

check_release_notes_status() {
  if [ "$DRY_RUN" = true ]; then
    info "Would validate release notes for $VERSION and print the scaffold command if missing"
    return
  fi

  if [ ! -f "$RELEASE_NOTES_SCRIPT" ]; then
    warn "Missing release notes helper at $RELEASE_NOTES_SCRIPT"
    warn "Publishing will fail until release notes tooling is restored."
    return
  fi

  if node "$RELEASE_NOTES_SCRIPT" validate --version "$VERSION" >/dev/null 2>&1; then
    ok "Release notes are ready for $VERSION"
    return
  fi

  warn "Release notes for $VERSION are missing or malformed."
  warn "Smoke can continue, but publish will fail until you create and finish release-notes/$VERSION.json."
  warn "Scaffold a draft with: node scripts/release-notes.js init --version $VERSION"
}

VERSION="$(node -p "require('$PROJECT_ROOT/package.json').version")"
PRODUCT="$(node -p "require('$PROJECT_ROOT/electron-builder.config.js').productName")"

ARM64_DMG="$PRODUCT-$VERSION-mac-arm64.dmg"
X64_DMG="$PRODUCT-$VERSION-mac-x64.dmg"
ARM64_ZIP="$PRODUCT-$VERSION-mac-arm64.zip"
X64_ZIP="$PRODUCT-$VERSION-mac-x64.zip"
ARM64_ZIP_BM="$PRODUCT-$VERSION-mac-arm64.zip.blockmap"
X64_ZIP_BM="$PRODUCT-$VERSION-mac-x64.zip.blockmap"
MANIFEST="latest-mac.yml"

EXPECTED_FILES=(
  "$ARM64_DMG"
  "$X64_DMG"
  "$ARM64_ZIP"
  "$X64_ZIP"
  "$ARM64_ZIP_BM"
  "$X64_ZIP_BM"
  "$MANIFEST"
)

HOST_ARCH="$(uname -m)"
case "$HOST_ARCH" in
  arm64)
    SMOKE_DMG="$RELEASE_DIR/$ARM64_DMG"
    ;;
  x86_64)
    SMOKE_DMG="$RELEASE_DIR/$X64_DMG"
    ;;
  *)
    fail "Unsupported host architecture for packaged smoke: $HOST_ARCH"
    ;;
esac

MOUNT_POINT=""
cleanup() {
  if [ -n "$MOUNT_POINT" ]; then
    hdiutil detach "$MOUNT_POINT" >/dev/null 2>&1 || true
    MOUNT_POINT=""
  fi
}
trap cleanup EXIT

info "Preflight: checking local tooling"
for tool in node npm xcrun hdiutil uname; do
  require_tool "$tool"
done

[ -f "$PROJECT_ROOT/scripts/packaged-smoke.js" ] || fail "Missing smoke helper: scripts/packaged-smoke.js"

if [ "$DRY_RUN" = true ]; then
  warn "Dry run enabled: no build, validation, DMG mount, or smoke launch will occur."
fi

if [ "$SKIP_BUILD" = true ]; then
  warn "Skip build enabled: existing release artifacts will be reused."
fi

info "Preflight: checking release note readiness"
check_release_notes_status

info "Step 1/3: Build, sign, notarize, and staple the mac release"
if [ "$DRY_RUN" = true ]; then
  info "Would run: npm run build:mac:release"
elif [ "$SKIP_BUILD" = true ]; then
  info "Skipping build and reusing release artifacts"
else
  npm --prefix "$PROJECT_ROOT" run build:mac:release
  ok "Build complete"
fi

info "Step 2/3: Verify local release artifacts and DMG notarization"
if [ "$DRY_RUN" = true ]; then
  info "Would verify 7 release artifacts exist in $RELEASE_DIR"
  info "Would validate stapled DMGs with xcrun stapler validate"
else
  for file_name in "${EXPECTED_FILES[@]}"; do
    [ -f "$RELEASE_DIR/$file_name" ] || fail "Missing artifact: release/$file_name"
  done

  for dmg in "$RELEASE_DIR/$ARM64_DMG" "$RELEASE_DIR/$X64_DMG"; do
    xcrun stapler validate "$dmg"
  done

  ok "All release artifacts exist and DMGs validate as notarized/stapled"
fi

info "Step 3/3: Mount the host-arch DMG and run packaged smoke checks"
if [ "$DRY_RUN" = true ]; then
  info "Would mount: $SMOKE_DMG"
  info "Would run packaged smoke helper against the mounted $PRODUCT.app"
else
  [ -f "$SMOKE_DMG" ] || fail "Missing smoke-test DMG: $SMOKE_DMG"

  ATTACH_OUTPUT="$(hdiutil attach -nobrowse -readonly "$SMOKE_DMG")"
  MOUNT_POINT="$(printf '%s\n' "$ATTACH_OUTPUT" | awk -F '\t' '/\/Volumes\// {print $NF}' | tail -n 1)"
  [ -n "$MOUNT_POINT" ] || fail "Could not determine mount point for $SMOKE_DMG"

  MOUNTED_APP="$MOUNT_POINT/$PRODUCT.app"
  [ -d "$MOUNTED_APP" ] || fail "Mounted DMG does not contain expected app: $MOUNTED_APP"

  info "Running packaged smoke checks from $MOUNTED_APP"
  node "$PROJECT_ROOT/scripts/packaged-smoke.js" \
    --app-bundle "$MOUNTED_APP" \
    --version "$VERSION"

  ok "Packaged smoke checks passed"
fi

printf '\n'
ok "Smoke-release workflow complete for $PRODUCT $VERSION"
info "No tag, GitHub release, or deploy steps were run."
info "If you want to continue with publishing after reviewing the smoke result, run:"
info "  ./scripts/ship.sh --skip-build"
printf '\n'
