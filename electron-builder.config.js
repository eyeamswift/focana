const fs = require('fs');
const path = require('path');

const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')
);

module.exports = {
  appId: 'app.focana.desktop',
  productName: 'Focana',
  artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  asar: true,
  afterSign: 'scripts/notarize.js',
  generateUpdatesFilesForAllChannels: true,
  electronUpdaterCompatibility: '>=2.16',
  publish: {
    provider: 'github',
    owner: 'eyeamswift',
    repo: 'focana',
    channel: 'latest',
    vPrefixedTagName: true,
  },
  files: [
    'package.json',
    'dist',
    'src/main',
    'src/assets',
    'scripts',
    '!reference',
    '!release',
    '!.claude',
    '!src/renderer',
  ],
  mac: {
    icon: 'build/icon.png',
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64'],
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64'],
      },
    ],
    category: 'public.app-category.productivity',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
  },
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: 'always',
    createStartMenuShortcut: true,
  },
  dmg: {
    contents: [
      { x: 130, y: 220 },
      {
        x: 410,
        y: 220,
        type: 'link',
        path: '/Applications',
      },
    ],
  },
};
