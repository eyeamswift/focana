const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let tray = null;

function createTray(mainWindow) {
  // Create a simple 16x16 tray icon
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = createFallbackIcon();
    }
  } catch (e) {
    icon = createFallbackIcon();
  }

  // Resize for tray
  icon = icon.resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip('Focana');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show/Hide',
      click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        mainWindow.destroy();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}

function createFallbackIcon() {
  // Create a simple orange circle as a fallback tray icon
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const r = 6;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= r) {
        canvas[offset] = 245;     // R
        canvas[offset + 1] = 158; // G
        canvas[offset + 2] = 11;  // B
        canvas[offset + 3] = 255; // A
      } else {
        canvas[offset] = 0;
        canvas[offset + 1] = 0;
        canvas[offset + 2] = 0;
        canvas[offset + 3] = 0;
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

module.exports = { createTray };
