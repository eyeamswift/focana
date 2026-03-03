/**
 * Patches the local Electron.app so macOS shows "Focana" in the dock
 * instead of "Electron" during development.
 *
 * 1. Renames Electron.app → Focana.app
 * 2. Renames the binary Contents/MacOS/Electron → Contents/MacOS/Focana
 * 3. Patches Info.plist: CFBundleName, CFBundleDisplayName, CFBundleExecutable
 * 4. Creates a symlink Electron.app → Focana.app so electron's CLI still works
 *
 * Idempotent — safe to run repeatedly.
 * Only affects node_modules/electron (re-created on npm install).
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const distDir = path.join(__dirname, '..', 'node_modules', 'electron', 'dist');
const electronApp = path.join(distDir, 'Electron.app');
const focanaApp = path.join(distDir, 'Focana.app');
const APP_NAME = 'Focana';

// Already renamed in a previous run
if (fs.existsSync(focanaApp) && !fs.lstatSync(focanaApp).isSymbolicLink()) {
  patchBundle(focanaApp);
  ensureSymlink();
  console.log(`Electron.app already renamed to Focana.app — verified.`);
  process.exit(0);
}

// Fresh state: Electron.app exists as a real directory
if (!fs.existsSync(electronApp) || fs.lstatSync(electronApp).isSymbolicLink()) {
  console.log('Electron.app not found or already a symlink — skipping patch.');
  process.exit(0);
}

// Rename Electron.app → Focana.app
fs.renameSync(electronApp, focanaApp);

// Patch bundle internals
patchBundle(focanaApp);

// Symlink so electron CLI can still find its .app bundle
ensureSymlink();

console.log(`Renamed Electron.app → Focana.app and patched dock name → "${APP_NAME}"`);

function patchBundle(appPath) {
  // Rename the binary: MacOS/Electron → MacOS/Focana
  const macosDir = path.join(appPath, 'Contents', 'MacOS');
  const oldBin = path.join(macosDir, 'Electron');
  const newBin = path.join(macosDir, APP_NAME);
  if (fs.existsSync(oldBin) && !fs.existsSync(newBin)) {
    fs.renameSync(oldBin, newBin);
  }
  // Symlink old binary name so electron's spawn still resolves
  if (fs.existsSync(newBin) && !fs.existsSync(oldBin)) {
    fs.symlinkSync(APP_NAME, oldBin);
  }

  // Patch Info.plist
  const plist = path.join(appPath, 'Contents', 'Info.plist');
  if (!fs.existsSync(plist)) return;

  const keys = ['CFBundleName', 'CFBundleDisplayName', 'CFBundleExecutable'];
  for (const key of keys) {
    try {
      const current = execSync(
        `/usr/libexec/PlistBuddy -c "Print :${key}" "${plist}"`,
        { encoding: 'utf8' },
      ).trim();
      if (current !== APP_NAME) {
        execSync(`/usr/libexec/PlistBuddy -c "Set :${key} ${APP_NAME}" "${plist}"`);
      }
    } catch {
      execSync(`/usr/libexec/PlistBuddy -c "Add :${key} string ${APP_NAME}" "${plist}"`);
    }
  }
}

function ensureSymlink() {
  try {
    const stat = fs.lstatSync(electronApp);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(electronApp);
    }
  } catch {
    // Doesn't exist — fine
  }
  fs.symlinkSync('Focana.app', electronApp);
}
