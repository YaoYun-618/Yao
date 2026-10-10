import { app, BrowserWindow, screen } from 'electron';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { Store } from './store';
import { registerIpcHandlers } from './ipc';
import { composeSetBottomScript } from './desktop-layer';

const store = new Store(path.join(app.getPath('userData'), 'store.json'));
registerIpcHandlers(store);

let win: BrowserWindow | null = null;

function createWindow(): void {
  const bounds = screen.getPrimaryDisplay().bounds;
  win = new BrowserWindow({
    x: bounds.x, y: bounds.y,
    width: bounds.width, height: bounds.height,
    frame: false, transparent: true, resizable: false,
    fullscreenable: false, skipTaskbar: true, show: false, roundedCorners: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.loadFile(path.join(__dirname, '../renderer/index.html'));
  win.once('ready-to-show', () => {
    win?.showInactive();
    if (process.platform === 'win32' && win) {
      exec(composeSetBottomScript(win.getNativeWindowHandle().readUInt32LE(0)), { windowsHide: true });
    }
  });
  win.on('closed', () => { win = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

process.on('uncaughtException', (err) => console.error('[RingDesk]', err));
