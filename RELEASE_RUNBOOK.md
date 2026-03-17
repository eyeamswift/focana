# Release Runbook

## Prerequisites

- Keep Apple notarization credentials in `/Users/swift/focana/.env.release`.
- Keep the GitHub release token in `/Users/swift/focana/.env.release.local` as:
  `GH_TOKEN=...`
- Standard releases must use a new non-prerelease semver such as `1.2.0`.

## Standard Mac Release Flow

1. Bump `version` in [package.json](/Users/swift/focana/package.json) and [package-lock.json](/Users/swift/focana/package-lock.json).
2. Commit and push the source changes.
3. Build the mac release artifacts:
   ```bash
   npm run build:mac:release
   ```
4. Create and push the git tag for that version:
   ```bash
   git tag v1.2.0
   git push origin v1.2.0
   ```
5. Publish the GitHub release from the existing local artifacts:
   ```bash
   gh release create v1.2.0 \
     release/Focana-1.2.0-mac-arm64.dmg \
     release/Focana-1.2.0-mac-arm64.dmg.blockmap \
     release/Focana-1.2.0-mac-arm64.zip \
     release/Focana-1.2.0-mac-arm64.zip.blockmap \
     release/Focana-1.2.0-mac-x64.dmg \
     release/Focana-1.2.0-mac-x64.dmg.blockmap \
     release/Focana-1.2.0-mac-x64.zip \
     release/Focana-1.2.0-mac-x64.zip.blockmap \
     release/latest-mac.yml \
     --repo eyeamswift/focana \
     --title "Focana 1.2.0"
   ```

## Verify Release Assets

The `v1.2.0` release must contain:

- `latest-mac.yml`
- `Focana-1.2.0-mac-arm64.zip`
- `Focana-1.2.0-mac-x64.zip`
- `Focana-1.2.0-mac-arm64.dmg`
- `Focana-1.2.0-mac-x64.dmg`
- all four blockmap files

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

1. Recalculate local artifact hashes.
2. Update `release/latest-mac.yml` to match the uploaded `.zip` and `.dmg` files.
3. Re-upload only the manifest:
   ```bash
   gh release upload v1.2.0 release/latest-mac.yml --repo eyeamswift/focana --clobber
   ```
4. Verify the live manifest contents:
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

`Prepare and ship v1.2.0 using the release runbook, publish the GitHub release, verify latest-mac.yml, and update the landing launch messaging if needed.`
