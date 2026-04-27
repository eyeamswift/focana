# Release Runbook

## Prerequisites

- Keep Apple notarization credentials in `/Users/swift/focana/.env.release`.
- Keep the GitHub release token in `/Users/swift/focana/.env.release.local` as:
  `GH_TOKEN=...`
- Keep the Lemon licensing IDs in `/Users/swift/focana/.env.release.local` (or `.env.release`) for packaged activation:
  - `FOCANA_LEMON_STORE_ID=...`
  - `FOCANA_LEMON_PRODUCT_ID=...`
  - `FOCANA_LEMON_VARIANT_IDS=...`
- Keep the PostHog renderer vars in `/Users/swift/focana/.env.release.local` (or `.env.release`) if release builds should report analytics:
  - `VITE_ENABLE_ANALYTICS=true`
  - `VITE_POSTHOG_KEY=...`
  - `VITE_POSTHOG_HOST=https://us.i.posthog.com` (optional; defaults to US ingestion)
- Standard releases must use a new non-prerelease semver such as `1.2.0`.
- Do not ship artifacts from `npm run build` or `npm run build:mac`. Those commands can still generate local builds that are not safe for release.

## Standard Mac Release Flow

1. Bump `version` in [package.json](/Users/swift/focana/package.json) and [package-lock.json](/Users/swift/focana/package-lock.json).
2. Commit and push the source changes.
3. Run the packaged smoke release flow first:
   ```bash
   ./scripts/ship-smoke.sh
   ```
   This builds the release artifacts, validates the stapled DMGs, mounts the host-arch DMG, and runs the packaged-app smoke checks locally. It intentionally stops before tagging, publishing, or deploying.
4. Rehearse the full ship flow without making changes:
   ```bash
   ./scripts/ship.sh --dry-run
   ```
5. If both checks pass, publish without rebuilding:
   ```bash
   ./scripts/ship.sh --skip-build
   ```
   `ship.sh` creates and pushes the version tag, publishes the GitHub release, syncs landing release notes, updates Vercel env vars, deploys preview and production for `focana.app`, and verifies the live pages.

## Preferred One-Command Flow

If you want the repo to enforce the standard sequence for you, use:

```bash
./scripts/ship-safe.sh
```

That wrapper runs:

1. `./scripts/ship-smoke.sh`
2. `./scripts/ship.sh --dry-run`
3. `./scripts/ship.sh --skip-build`

## Verify Release Assets

The `v1.2.0` release must contain:

- `latest-mac.yml`
- `Focana-1.2.0-mac-arm64.zip`
- `Focana-1.2.0-mac-x64.zip`
- `Focana-1.2.0-mac-arm64.dmg`
- `Focana-1.2.0-mac-x64.dmg`
- both ZIP blockmap files

Do not upload DMG blockmaps. DMG stapling changes the DMG bytes, so the build script removes those stale blockmaps automatically.

Verify the updater manifest URL resolves:

```bash
curl -I https://github.com/eyeamswift/focana/releases/download/v1.2.0/latest-mac.yml
```

Expected result: `302`, not `404`.

## If Uploads Partially Fail

Do not rebuild first.

1. Check which assets are already on the release:
   ```bash
   gh release view v1.2.0 --repo eyeamswift/focana --json assets,url
   ```
2. Upload only the missing files:
   ```bash
   gh release upload v1.2.0 <missing-files...> --repo eyeamswift/focana --clobber
   ```
3. If the release was created under an `untagged-...` URL, delete it and recreate it after pushing the real git tag:
   ```bash
   gh release delete v1.2.0 --repo eyeamswift/focana --yes
   gh release create v1.2.0 ... --repo eyeamswift/focana --title "Focana 1.2.0"
   ```

## If The App Reports A Checksum Mismatch

The published `latest-mac.yml` is stale relative to the uploaded binaries.

1. Re-run `npm run build:mac:release` so the script can restaple the DMGs and refresh `release/latest-mac.yml`.
2. Re-upload only the corrected manifest:
   ```bash
   gh release upload v1.2.0 release/latest-mac.yml --repo eyeamswift/focana --clobber
   ```
3. Verify the live manifest contents:
   ```bash
   curl -L https://github.com/eyeamswift/focana/releases/download/v1.2.0/latest-mac.yml
   ```

## Updater Smoke Test

From the previously installed packaged build:

1. Open the app or click `Check for Updates`.
2. Wait for `Update Ready`.
3. Click `Restart to Update`.
4. Open Settings and confirm the new version is installed.

Do not use tray `Restart App` to install the update.

## Landing Page Sync

After publishing a new release:

- confirm the landing-page CTA copy still matches launch messaging
- if you uploaded new Mac files in Lemon Squeezy, update the landing env file IDs before deploying `/Users/swift/focana-landing`
- keep the checkout and verified download flow pointed at Lemon, not GitHub assets

## Best Prompt To Give Codex Next Time

Use:

`Prepare and ship v1.2.0 using the release runbook. Always run ./scripts/ship-smoke.sh first, then ./scripts/ship.sh --dry-run, then ./scripts/ship.sh --skip-build if both pass.`
