import { exec } from 'node:child_process';
import { ipcMain, BrowserWindow } from 'electron';
import { Store } from './store';
import { scanAll } from './app-scanner';
import { launchEntry } from './launcher';
import { composeHideIconsCommand } from './desktop-layer';
import { AppEntry, RingConfig } from '../shared/types';

type WithSchema = { schemaVersion?: unknown };

export function validateConfig(cfg: unknown): cfg is RingConfig {
  if (typeof cfg !== 'object' || cfg === null) return false;
  const c = cfg as WithSchema & Record<string, unknown>;
  if (c.schemaVersion !== 1) return false;
  const theme = c.theme;
  if (theme !== 'dark' && theme !== 'light') return false;
  const num = (...keys: string[]): boolean =>
    keys.every((k) => typeof c[k] === 'number' && Number.isFinite(c[k]));
  return num('diameterRatio', 'opacity', 'colorSaturation', 'fontScale')
    && Array.isArray(c.apps) && Array.isArray(c.categories);
}

export function validateAppEntry(entry: unknown): entry is AppEntry {
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return typeof e.id === 'string' && typeof e.name === 'string'
    && typeof e.iconPath === 'string' && typeof e.target === 'string'
    && (e.source === 'start-menu' || e.source === 'desktop-file' || e.source === 'manual')
    && (e.categoryId === null || typeof e.categoryId === 'string')
    && typeof e.pinned === 'boolean';
}

export function registerIpcHandlers(store: Store): void {
  ipcMain.handle('config:load', () => store.load());

  ipcMain.handle('config:save', (_evt, cfg: unknown): boolean => {
    if (!validateConfig(cfg)) return false;
    store.save(cfg);
    return true;
  });

  ipcMain.handle('apps:scan', async () => {
    try {
      const { apps, warnings } = await scanAll();
      const merged = store.mergeApps(store.load(), apps);
      const next = { ...store.load(), apps: merged };
      store.save(next);
      return { apps: merged, warnings };
    } catch (err) {
      return { apps: [], warnings: [String(err instanceof Error ? err.message : err)] };
    }
  });

  ipcMain.handle('app:launch', async (_evt, entry: unknown) => {
    if (!validateAppEntry(entry)) return { ok: false, error: '无效条目' };
    return launchEntry(entry);
  });

  ipcMain.handle('desktop:hideIcons', (_evt, enabled: unknown): boolean => {
    if (typeof enabled !== 'boolean') return false;
    if (process.platform !== 'win32') return false;
    exec(composeHideIconsCommand(enabled), { windowsHide: true }, (err: Error | null) => {
      if (err) BrowserWindow.getAllWindows()[0]?.webContents.send('config:toast', '隐藏桌面图标失败');
    });
    return true;
  });
}
