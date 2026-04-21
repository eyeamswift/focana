#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LANDING_ROOT="$PROJECT_ROOT/../focana-landing"
RELEASE_DIR="$PROJECT_ROOT/release"
VERCEL_PROJECT_FILE="$LANDING_ROOT/.vercel/project.json"
RELEASE_ENV_FILE="$PROJECT_ROOT/.env.release"
RELEASE_ENV_LOCAL_FILE="$PROJECT_ROOT/.env.release.local"

SKIP_BUILD=false
DRY_RUN=false

info() { printf '\033[1;34m[ship]\033[0m %s\n' "$1"; }
ok() { printf '\033[1;32m[ship]\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m[ship]\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31m[ship]\033[0m %s\n' "$1" >&2; exit 1; }

load_release_env() {
  local env_file
  for env_file in "$RELEASE_ENV_FILE" "$RELEASE_ENV_LOCAL_FILE"; do
    if [ -f "$env_file" ]; then
      # shellcheck disable=SC1090
      set -a; . "$env_file"; set +a
    fi
  done
}

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

upsert_vercel_env() {
  local key="$1"
  local environment="$2"
  local value="$3"
  local allow_branch_collision="${4:-false}"
  local output=""

  if output="$(vercel env add "$key" "$environment" --cwd "$LANDING_ROOT" --value "$value" --force --yes 2>&1)"; then
    printf '%s\n' "$output"
    return 0
  fi

  printf '%s\n' "$output"

  if [ "$allow_branch_collision" = true ] && grep -Fq '"reason": "git_branch_required"' <<<"$output"; then
    warn "Skipping preview env update for $key because Vercel found branch-scoped Preview overrides and now requires an explicit branch."
    warn "Production deploys will still use the correct GitHub DMG URLs."
    return 0
  fi

  fail "Could not update $key for $environment in Vercel."
}

require_github_auth() {
  if gh auth status >/dev/null 2>&1; then
    return
  fi

  if [ -n "${GH_TOKEN:-}" ] || [ -n "${GITHUB_TOKEN:-}" ]; then
    gh api user >/dev/null 2>&1 || fail "GitHub CLI could not authenticate with GH_TOKEN/GITHUB_TOKEN."
    return
  fi

  fail "GitHub CLI is not authenticated. Run 'gh auth login' first or provide GH_TOKEN."
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

cleanup_temp_files() {
  if [ -n "${RELEASE_NOTES_BODY_FILE:-}" ] && [ -f "${RELEASE_NOTES_BODY_FILE:-}" ]; then
    rm -f "$RELEASE_NOTES_BODY_FILE"
  fi
}

VERSION="$(node -p "require('$PROJECT_ROOT/package.json').version")"
PRODUCT="$(node -p "require('$PROJECT_ROOT/electron-builder.config.js').productName")"
REPO="$(node -p "const config = require('$PROJECT_ROOT/electron-builder.config.js'); config.publish.owner + '/' + config.publish.repo")"
TAG="v$VERSION"
RELEASE_NOTES_SCRIPT="$PROJECT_ROOT/scripts/release-notes.js"
RELEASE_NOTES_BODY_FILE=""

trap cleanup_temp_files EXIT

load_release_env

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

prepare_release_notes() {
  if [ "$DRY_RUN" = true ]; then
    info "Would validate and render release notes for $VERSION"
    return
  fi

  if [ ! -f "$RELEASE_NOTES_SCRIPT" ]; then
    fail "Missing release notes helper at $RELEASE_NOTES_SCRIPT"
  fi

  if ! node "$RELEASE_NOTES_SCRIPT" validate --version "$VERSION" >/dev/null 2>&1; then
    fail "Release notes for $VERSION are missing or malformed. Create or update release-notes/$VERSION.json before publishing."
  fi

  RELEASE_NOTES_BODY_FILE="$(mktemp -t focana-release-notes.XXXXXX)"
  if ! node "$RELEASE_NOTES_SCRIPT" render-github --version "$VERSION" >"$RELEASE_NOTES_BODY_FILE"; then
    rm -f "$RELEASE_NOTES_BODY_FILE"
    RELEASE_NOTES_BODY_FILE=""
    fail "Could not render GitHub release notes for $VERSION."
  fi

  if [ ! -s "$RELEASE_NOTES_BODY_FILE" ]; then
    rm -f "$RELEASE_NOTES_BODY_FILE"
    RELEASE_NOTES_BODY_FILE=""
    fail "Rendered GitHub release notes for $VERSION were empty."
  fi

  ok "Release notes loaded for $VERSION"
}

sync_landing_release_notes() {
  if [ "$DRY_RUN" = true ]; then
    info "Would sync landing updates data from release notes"
    return
  fi

  if [ ! -f "$RELEASE_NOTES_SCRIPT" ]; then
    fail "Missing release notes helper at $RELEASE_NOTES_SCRIPT"
  fi

  if node "$RELEASE_NOTES_SCRIPT" sync-landing --landing-root "$LANDING_ROOT"; then
    ok "Landing updates data synced"
  else
    fail "Landing updates sync failed because the release notes are missing, malformed, or could not be processed."
  fi
}

verify_friends_and_family_flow() {
  local download_page="$LANDING_ROOT/src/pages/download.astro"
  local next_steps_page="$LANDING_ROOT/src/pages/next-steps.astro"
  local friends_page="$LANDING_ROOT/src/pages/friends-and-family/[slug].astro"
  local friends_checkout_api="$LANDING_ROOT/src/pages/api/friends-and-family/[slug]/checkout.ts"
  local friends_lib="$LANDING_ROOT/src/lib/friendsAndFamily.ts"
  local production_envs
  local preview_envs

  if [ "$DRY_RUN" = true ]; then
    info "Would verify the landing download pages still read the GitHub DMG env vars"
    info "Would verify the friends-and-family checkout stays wired to LEMONSQUEEZY_FREE_VARIANT_ID"
    info "Would verify the friends-and-family checkout and receipt flow still redirect through /download"
    return
  fi

  [ -f "$download_page" ] || fail "Missing landing download page source at $download_page"
  [ -f "$next_steps_page" ] || fail "Missing landing next-steps page source at $next_steps_page"
  [ -f "$friends_page" ] || fail "Missing landing friends-and-family page source at $friends_page"
  [ -f "$friends_checkout_api" ] || fail "Missing landing friends-and-family checkout API source at $friends_checkout_api"
  [ -f "$friends_lib" ] || fail "Missing landing friends-and-family helper source at $friends_lib"

  grep -Fq "PUBLIC_GITHUB_ARM64_DMG_URL" "$download_page" || fail "/download is no longer wired to PUBLIC_GITHUB_ARM64_DMG_URL"
  grep -Fq "PUBLIC_GITHUB_X64_DMG_URL" "$download_page" || fail "/download is no longer wired to PUBLIC_GITHUB_X64_DMG_URL"
  grep -Fq "PUBLIC_GITHUB_ARM64_DMG_URL" "$next_steps_page" || fail "/next-steps is no longer wired to PUBLIC_GITHUB_ARM64_DMG_URL"
  grep -Fq "PUBLIC_GITHUB_X64_DMG_URL" "$next_steps_page" || fail "/next-steps is no longer wired to PUBLIC_GITHUB_X64_DMG_URL"
  grep -Fq "const storeId = import.meta.env.LEMONSQUEEZY_STORE_ID;" "$friends_checkout_api" || fail "Friends-and-family checkout no longer reads LEMONSQUEEZY_STORE_ID"
  grep -Fq "const variantId = import.meta.env.LEMONSQUEEZY_FREE_VARIANT_ID;" "$friends_checkout_api" || fail "Friends-and-family checkout no longer reads LEMONSQUEEZY_FREE_VARIANT_ID"
  grep -Fq "enabled_variants: [Number(variantId)]," "$friends_lib" || fail "Friends-and-family checkout no longer constrains checkout to the free Lemon variant"
  grep -Fq "const downloadUrl = new URL('/download', origin).toString();" "$friends_lib" || fail "Friends-and-family checkout no longer routes through /download"
  grep -Fq "redirect_url: downloadUrl" "$friends_lib" || fail "Friends-and-family checkout redirect no longer points to /download"
  grep -Fq "receipt_link_url: downloadUrl" "$friends_lib" || fail "Friends-and-family receipt CTA no longer points to /download"
  grep -Fq "const redirectUrl = new URL('/download', window.location.origin);" "$friends_page" || fail "Friends-and-family success flow no longer sends purchasers to /download"

  production_envs="$(vercel env ls production --cwd "$LANDING_ROOT")" || fail "Could not load Vercel production env vars for landing"
  preview_envs="$(vercel env ls preview --cwd "$LANDING_ROOT")" || fail "Could not load Vercel preview env vars for landing"

  grep -Fq "LEMONSQUEEZY_STORE_ID" <<<"$production_envs" || fail "Landing production env is missing LEMONSQUEEZY_STORE_ID"
  grep -Fq "LEMONSQUEEZY_FREE_VARIANT_ID" <<<"$production_envs" || fail "Landing production env is missing LEMONSQUEEZY_FREE_VARIANT_ID"
  grep -Fq "LEMONSQUEEZY_STORE_ID" <<<"$preview_envs" || fail "Landing preview env is missing LEMONSQUEEZY_STORE_ID"
  grep -Fq "LEMONSQUEEZY_FREE_VARIANT_ID" <<<"$preview_envs" || fail "Landing preview env is missing LEMONSQUEEZY_FREE_VARIANT_ID"

  ok "Friends-and-family flow stays wired to the free Lemon variant and the refreshed download pages"
}

commit_landing_release_notes() {
  local release_file="$LANDING_ROOT/src/data/releases.json"

  if [ "$DRY_RUN" = true ]; then
    info "Would commit and push $release_file on landing main if it changed"
    return
  fi

  if [ ! -f "$release_file" ]; then
    fail "Expected synced landing release data at $release_file"
  fi

  if git -C "$LANDING_ROOT" diff --quiet -- "$release_file" && git -C "$LANDING_ROOT" diff --cached --quiet -- "$release_file"; then
    info "Landing release data already matches $VERSION"
    return
  fi

  git -C "$LANDING_ROOT" add src/data/releases.json
  git -C "$LANDING_ROOT" commit -m "Update release notes for $VERSION"
  git -C "$LANDING_ROOT" push origin main
  ok "Landing release notes committed and pushed"
}

verify_landing_production() {
  if [ "$DRY_RUN" = true ]; then
    info "Would verify focana.app/download, /next-steps, and /updates reflect $VERSION"
    info "Would verify the friends-and-family flow still lands on the refreshed download CTAs"
    return
  fi

  local download_html
  local next_steps_html
  local updates_html

  verify_friends_and_family_flow

  download_html="$(curl -fsSL "https://focana.app/download")" || fail "Could not fetch https://focana.app/download"
  next_steps_html="$(curl -fsSL "https://focana.app/next-steps")" || fail "Could not fetch https://focana.app/next-steps"
  updates_html="$(curl -fsSL "https://focana.app/updates")" || fail "Could not fetch https://focana.app/updates"

  grep -Fq "$ARM64_URL" <<<"$download_html" || fail "/download does not reference the $VERSION arm64 DMG"
  grep -Fq "$X64_URL" <<<"$download_html" || fail "/download does not reference the $VERSION x64 DMG"
  grep -Fq "$ARM64_URL" <<<"$next_steps_html" || fail "/next-steps does not reference the $VERSION arm64 DMG"
  grep -Fq "$X64_URL" <<<"$next_steps_html" || fail "/next-steps does not reference the $VERSION x64 DMG"
  grep -Fq "Version $VERSION" <<<"$updates_html" || fail "/updates does not show Version $VERSION"

  ok "Landing production routes and the friends-and-family download flow reference the latest DMGs and release notes"
}

info "Preflight: checking local tooling, auth, and repo state"

for tool in node gh vercel curl git xcrun; do
  require_tool "$tool"
done

require_github_auth
vercel whoami >/dev/null 2>&1 || fail "Vercel CLI is not authenticated. Run 'vercel login' first."

[ -d "$LANDING_ROOT" ] || fail "Missing landing repo: $LANDING_ROOT"
[ -f "$VERCEL_PROJECT_FILE" ] || fail "Missing Vercel link file: $VERCEL_PROJECT_FILE"

LANDING_BRANCH="$(git -C "$LANDING_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || printf 'unknown')"

if [ "$SKIP_BUILD" = false ] && [ "$DRY_RUN" = false ]; then
  if [ -n "$(git -C "$PROJECT_ROOT" status --porcelain)" ]; then
    fail "Git working tree is dirty. Commit or stash changes, or rerun with --skip-build."
  fi
fi

if [ "$DRY_RUN" = false ] && [ "$LANDING_BRANCH" != "main" ]; then
  fail "Landing repo must be on main before shipping so production download links and the updates page stay in sync. Current branch: $LANDING_BRANCH"
fi

if [ "$DRY_RUN" = false ] && [ -n "$(git -C "$LANDING_ROOT" status --porcelain)" ]; then
  fail "Landing repo is dirty. Commit or stash changes before shipping so production deploys stay reproducible."
fi

if [ "$DRY_RUN" = true ]; then
  warn "Dry run enabled: build, tag push, GitHub publish, env updates, local .env updates, and redeploys will be skipped."
fi

if [ "$SKIP_BUILD" = true ]; then
  warn "Skip build enabled: existing release artifacts will be reused."
fi

prepare_release_notes

info "Step 1/11: Build, sign, notarize, and staple the mac release"
if [ "$DRY_RUN" = true ]; then
  info "Would run: npm run build:mac:release"
elif [ "$SKIP_BUILD" = true ]; then
  info "Skipping build and reusing release artifacts"
else
  npm --prefix "$PROJECT_ROOT" run build:mac:release
  ok "Build complete"
fi

info "Step 2/11: Verify local release artifacts and DMG notarization"
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

info "Step 3/11: Create and push the release tag"
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

info "Step 4/11: Publish the GitHub release"
if [ "$DRY_RUN" = true ]; then
  info "Would create or update GitHub release $TAG with 7 assets"
else
  if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
    gh release upload "$TAG" "${ASSET_PATHS[@]}" --repo "$REPO" --clobber
    if [ -n "$RELEASE_NOTES_BODY_FILE" ]; then
      gh release edit "$TAG" --repo "$REPO" --notes-file "$RELEASE_NOTES_BODY_FILE"
    fi
  else
    CREATE_ARGS=(release create "$TAG" "${ASSET_PATHS[@]}" --repo "$REPO" --title "$PRODUCT $VERSION")
    if [[ "$VERSION" == *-* ]]; then
      CREATE_ARGS+=(--prerelease)
    fi
    if [ -n "$RELEASE_NOTES_BODY_FILE" ]; then
      CREATE_ARGS+=(--notes-file "$RELEASE_NOTES_BODY_FILE")
    fi
    gh "${CREATE_ARGS[@]}"
  fi

  ok "GitHub release $TAG published"
fi

info "Step 5/11: Verify GitHub release assets"
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

info "Step 6/11: Verify public download URLs"
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

info "Step 7/11: Sync landing updates data"
sync_landing_release_notes

info "Step 8/12: Commit and push landing release notes"
commit_landing_release_notes

info "Step 9/12: Update Vercel env vars (production + preview)"
if [ "$DRY_RUN" = true ]; then
  info "Would upsert PUBLIC_GITHUB_ARM64_DMG_URL and PUBLIC_GITHUB_X64_DMG_URL for production"
  info "Would upsert PUBLIC_GITHUB_ARM64_DMG_URL and PUBLIC_GITHUB_X64_DMG_URL for preview"
else
  upsert_vercel_env PUBLIC_GITHUB_ARM64_DMG_URL production "$ARM64_URL"
  upsert_vercel_env PUBLIC_GITHUB_X64_DMG_URL production "$X64_URL"
  upsert_vercel_env PUBLIC_GITHUB_ARM64_DMG_URL preview "$ARM64_URL" true
  upsert_vercel_env PUBLIC_GITHUB_X64_DMG_URL preview "$X64_URL" true

  ok "Vercel env vars updated for production and preview"
fi

info "Step 10/12: Update the local landing env file"
if [ "$DRY_RUN" = true ]; then
  info "Would update $LANDING_ROOT/.env with the latest GitHub DMG URLs"
else
  update_local_env "$LANDING_ROOT/.env" "PUBLIC_GITHUB_ARM64_DMG_URL" "$ARM64_URL"
  update_local_env "$LANDING_ROOT/.env" "PUBLIC_GITHUB_X64_DMG_URL" "$X64_URL"
  ok "Local landing .env updated"
fi

info "Step 11/12: Redeploy Vercel preview and production"
if [ "$DRY_RUN" = true ]; then
  info "Would trigger a preview deploy for $LANDING_ROOT"
  info "Would trigger a production deploy for $LANDING_ROOT"
else
  vercel --cwd "$LANDING_ROOT" --yes
  ok "Vercel preview deploy triggered"

  vercel --cwd "$LANDING_ROOT" --prod --yes
  ok "Vercel production deploy triggered"
fi

info "Step 12/12: Verify live landing pages"
verify_landing_production

info "Summary"
printf '\n'
ok "Release workflow ready for $PRODUCT $VERSION"
info "GitHub release: https://github.com/$REPO/releases/tag/$TAG"
info "ARM64 DMG:      $ARM64_URL"
info "x64 DMG:        $X64_URL"
printf '\n'
