#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LANDING_ROOT="$PROJECT_ROOT/../focana-landing"
RELEASE_DIR="$PROJECT_ROOT/release"
VERCEL_PROJECT_FILE="$LANDING_ROOT/.vercel/project.json"

SKIP_BUILD=false
DRY_RUN=false

info() { printf '\033[1;34m[ship]\033[0m %s\n' "$1"; }
ok() { printf '\033[1;32m[ship]\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m[ship]\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31m[ship]\033[0m %s\n' "$1" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage: ./scripts/ship.sh [--skip-build] [--dry-run]

  --skip-build  Reuse existing release artifacts instead of rebuilding them
  --dry-run     Print the release steps without making changes
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

update_local_env() {
  local file="$1"
  local key="$2"
  local value="$3"

  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >>"$file"
  fi
}

VERSION="$(node -p "require('$PROJECT_ROOT/package.json').version")"
PRODUCT="$(node -p "require('$PROJECT_ROOT/electron-builder.config.js').productName")"
REPO="$(node -p "const config = require('$PROJECT_ROOT/electron-builder.config.js'); config.publish.owner + '/' + config.publish.repo")"
TAG="v$VERSION"

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

ASSET_PATHS=()
for file_name in "${EXPECTED_FILES[@]}"; do
  ASSET_PATHS+=("$RELEASE_DIR/$file_name")
done

GITHUB_DL="https://github.com/$REPO/releases/download/$TAG"
ARM64_URL="$GITHUB_DL/$ARM64_DMG"
X64_URL="$GITHUB_DL/$X64_DMG"

info "Preflight: checking local tooling, auth, and repo state"

for tool in node gh vercel curl git xcrun; do
  require_tool "$tool"
done

gh auth status >/dev/null 2>&1 || fail "GitHub CLI is not authenticated. Run 'gh auth login' first."
vercel whoami >/dev/null 2>&1 || fail "Vercel CLI is not authenticated. Run 'vercel login' first."

[ -d "$LANDING_ROOT" ] || fail "Missing landing repo: $LANDING_ROOT"
[ -f "$VERCEL_PROJECT_FILE" ] || fail "Missing Vercel link file: $VERCEL_PROJECT_FILE"

if [ "$SKIP_BUILD" = false ] && [ "$DRY_RUN" = false ]; then
  if [ -n "$(git -C "$PROJECT_ROOT" status --porcelain)" ]; then
    fail "Git working tree is dirty. Commit or stash changes, or rerun with --skip-build."
  fi
fi

if [ "$DRY_RUN" = true ]; then
  warn "Dry run enabled: build, tag push, GitHub publish, env updates, local .env updates, and redeploys will be skipped."
fi

if [ "$SKIP_BUILD" = true ]; then
  warn "Skip build enabled: existing release artifacts will be reused."
fi

info "Step 1/10: Build, sign, notarize, and staple the mac release"
if [ "$DRY_RUN" = true ]; then
  info "Would run: npm run build:mac:release"
elif [ "$SKIP_BUILD" = true ]; then
  info "Skipping build and reusing release artifacts"
else
  npm --prefix "$PROJECT_ROOT" run build:mac:release
  ok "Build complete"
fi

info "Step 2/10: Verify local release artifacts and DMG notarization"
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

info "Step 3/10: Create and push the release tag"
CURRENT_BRANCH="$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "main" ]; then
  warn "Current branch is $CURRENT_BRANCH, not main. The release tag will still point at the current commit."
fi

if [ "$DRY_RUN" = true ]; then
  info "Would ensure local tag $TAG exists"
  info "Would push tag $TAG to origin"
else
  if ! git -C "$PROJECT_ROOT" rev-parse -q --verify "refs/tags/$TAG" >/dev/null 2>&1; then
    git -C "$PROJECT_ROOT" tag "$TAG"
  fi

  if ! git -C "$PROJECT_ROOT" ls-remote --tags origin "$TAG" | grep -q "$TAG"; then
    git -C "$PROJECT_ROOT" push origin "$TAG"
  fi

  ok "Tag $TAG exists locally and on origin"
fi

info "Step 4/10: Publish the GitHub release"
if [ "$DRY_RUN" = true ]; then
  info "Would create or update GitHub release $TAG with 7 assets"
else
  if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
    gh release upload "$TAG" "${ASSET_PATHS[@]}" --repo "$REPO" --clobber
  else
    CREATE_ARGS=(release create "$TAG" "${ASSET_PATHS[@]}" --repo "$REPO" --title "$PRODUCT $VERSION")
    if [[ "$VERSION" == *-* ]]; then
      CREATE_ARGS+=(--prerelease)
    fi
    gh "${CREATE_ARGS[@]}"
  fi

  ok "GitHub release $TAG published"
fi

info "Step 5/10: Verify GitHub release assets"
if [ "$DRY_RUN" = true ]; then
  info "Would confirm all 7 assets are present on GitHub release $TAG"
else
  REMOTE_ASSETS="$(gh release view "$TAG" --repo "$REPO" --json assets --jq '.assets[].name' | sort)"
  MISSING=()

  for file_name in "${EXPECTED_FILES[@]}"; do
    if ! grep -qx "$file_name" <<<"$REMOTE_ASSETS"; then
      MISSING+=("$file_name")
    fi
  done

  if [ "${#MISSING[@]}" -gt 0 ]; then
    fail "Missing from GitHub release: ${MISSING[*]}"
  fi

  ok "All assets verified on GitHub release"
fi

info "Step 6/10: Verify public download URLs"
if [ "$DRY_RUN" = true ]; then
  info "Would check $ARM64_DMG, $X64_DMG, and $MANIFEST for HTTP 200/302"
else
  for file_name in "$ARM64_DMG" "$X64_DMG" "$MANIFEST"; do
    url="$GITHUB_DL/$file_name"
    http_code="$(curl -sI -o /dev/null -w '%{http_code}' "$url")"
    if [ "$http_code" != "302" ] && [ "$http_code" != "200" ]; then
      fail "$file_name returned HTTP $http_code (expected 302 or 200)"
    fi
  done

  ok "GitHub release download URLs are live"
fi

info "Step 7/10: Update Vercel env vars"
if [ "$DRY_RUN" = true ]; then
  info "Would upsert PUBLIC_GITHUB_ARM64_DMG_URL and PUBLIC_GITHUB_X64_DMG_URL for production"
  info "Would upsert the same vars for preview branch codex/landing-preview"
else
  vercel env add PUBLIC_GITHUB_ARM64_DMG_URL production --cwd "$LANDING_ROOT" --value "$ARM64_URL" --force --yes
  vercel env add PUBLIC_GITHUB_X64_DMG_URL production --cwd "$LANDING_ROOT" --value "$X64_URL" --force --yes
  vercel env add PUBLIC_GITHUB_ARM64_DMG_URL preview codex/landing-preview --cwd "$LANDING_ROOT" --value "$ARM64_URL" --force --yes
  vercel env add PUBLIC_GITHUB_X64_DMG_URL preview codex/landing-preview --cwd "$LANDING_ROOT" --value "$X64_URL" --force --yes

  ok "Vercel env vars updated for production and codex/landing-preview"
fi

info "Step 8/10: Update the local landing env file"
if [ "$DRY_RUN" = true ]; then
  info "Would update $LANDING_ROOT/.env with the latest GitHub DMG URLs"
else
  update_local_env "$LANDING_ROOT/.env" "PUBLIC_GITHUB_ARM64_DMG_URL" "$ARM64_URL"
  update_local_env "$LANDING_ROOT/.env" "PUBLIC_GITHUB_X64_DMG_URL" "$X64_URL"
  ok "Local landing .env updated"
fi

info "Step 9/10: Redeploy Vercel"
if [ "$DRY_RUN" = true ]; then
  info "Would trigger a production deploy and a preview deploy for $LANDING_ROOT"
else
  LANDING_BRANCH="$(git -C "$LANDING_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || printf 'unknown')"
  if [ "$LANDING_BRANCH" != "codex/landing-preview" ]; then
    warn "Landing repo is on $LANDING_BRANCH, so the preview deploy will use that branch context."
  fi

  vercel --prod --cwd "$LANDING_ROOT" --yes
  vercel --cwd "$LANDING_ROOT" --yes
  ok "Vercel production and preview deploys triggered"
fi

info "Step 10/10: Summary"
printf '\n'
ok "Release workflow ready for $PRODUCT $VERSION"
info "GitHub release: https://github.com/$REPO/releases/tag/$TAG"
info "ARM64 DMG:      $ARM64_URL"
info "x64 DMG:        $X64_URL"
printf '\n'
